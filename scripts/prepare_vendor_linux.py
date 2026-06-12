from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor"
CACHE = VENDOR / ".downloads"
ANDROID_REPOSITORY_XML = "https://dl.google.com/android/repository/repository2-1.xml"
ANDROID_REPOSITORY_BASE = "https://dl.google.com/android/repository/"
NODE_INDEX = "https://nodejs.org/dist/index.json"
TEMURIN_JDK17 = "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
HTTP_HEADERS = {"User-Agent": "LauncherEVA/0.1.0"}


def require_linux_x64() -> None:
    machine = platform.machine().lower()
    if sys.platform != "linux" or machine not in {"x86_64", "amd64"}:
        raise SystemExit("Este preparador descarga toolchain Linux x64. Ejecutalo en Linux x64.")


def url_json(url: str):
    request = urllib.request.Request(url, headers=HTTP_HEADERS)
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def url_text(url: str) -> str:
    request = urllib.request.Request(url, headers=HTTP_HEADERS)
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8")


def download(url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 0:
        print(f"Usando cache: {destination.name}")
        return destination

    temporary = destination.with_suffix(destination.suffix + ".part")
    if temporary.exists():
        temporary.unlink()

    print(f"Descargando: {url}")
    request = urllib.request.Request(url, headers=HTTP_HEADERS)
    with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as file:
        shutil.copyfileobj(response, file)
    temporary.replace(destination)
    return destination


def extract_archive(archive: Path, destination: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="launcher-eva-vendor-") as temp_dir:
        extracted = Path(temp_dir) / "extracted"
        extracted.mkdir()

        if archive.suffix == ".zip":
            with zipfile.ZipFile(archive) as zip_file:
                zip_file.extractall(extracted)
        else:
            with tarfile.open(archive) as tar_file:
                tar_file.extractall(extracted)

        entries = [path for path in extracted.iterdir() if path.name != "__MACOSX"]
        source = entries[0] if len(entries) == 1 and entries[0].is_dir() else extracted

        if destination.exists():
            shutil.rmtree(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source, destination, symlinks=True)


def chmod_executables(directory: Path) -> None:
    for path in directory.rglob("*"):
        if path.is_file() and (path.parent.name == "bin" or path.suffix in {"", ".sh"}):
            try:
                path.chmod(path.stat().st_mode | 0o755)
            except OSError:
                pass


def node_lts_version() -> str:
    versions = url_json(NODE_INDEX)
    for item in versions:
        files = set(item.get("files", []))
        if item.get("lts") and "linux-x64" in files:
            return item["version"]
    raise SystemExit("No se encontro una version LTS de Node para linux-x64.")


def install_node(version: str) -> None:
    if version == "auto":
        version = node_lts_version()
    filename = f"node-{version}-linux-x64.tar.xz"
    archive = download(f"https://nodejs.org/dist/{version}/{filename}", CACHE / filename)
    extract_archive(archive, VENDOR / "node")
    chmod_executables(VENDOR / "node")
    print(f"Node preparado: {version}")


def install_jdk() -> None:
    archive = download(TEMURIN_JDK17, CACHE / "temurin-jdk17-linux-x64.tar.gz")
    extract_archive(archive, VENDOR / "jdk")
    chmod_executables(VENDOR / "jdk")
    print("JDK 17 preparado.")


def android_cmdline_tools_url() -> str:
    xml = ElementTree.fromstring(url_text(ANDROID_REPOSITORY_XML))

    def local_name(tag: str) -> str:
        return tag.rsplit("}", 1)[-1]

    def child_text(element: ElementTree.Element, name: str) -> str | None:
        for child in element:
            if local_name(child.tag) == name:
                return child.text
        return None

    for package in xml.iter():
        if package.attrib.get("path") != "cmdline-tools;latest":
            continue
        for archive in package.iter():
            if local_name(archive.tag) != "archive":
                continue
            host_os = child_text(archive, "host-os")
            complete = next((child for child in archive if local_name(child.tag) == "complete"), None)
            url = child_text(complete, "url") if complete is not None else None
            if host_os == "linux" and url:
                return ANDROID_REPOSITORY_BASE + url
    raise SystemExit("No se encontro Android command-line tools para Linux.")


def install_android_commandline_tools() -> Path:
    url = android_cmdline_tools_url()
    archive = download(url, CACHE / "android-commandlinetools-linux-latest.zip")
    destination = VENDOR / "android-sdk" / "cmdline-tools" / "latest"
    extract_archive(archive, destination)
    chmod_executables(destination)
    print("Android command-line tools preparados.")
    return destination / "bin" / "sdkmanager"


def sdkmanager_environment() -> dict[str, str]:
    env = os.environ.copy()
    env["JAVA_HOME"] = str(VENDOR / "jdk")
    env["ANDROID_HOME"] = str(VENDOR / "android-sdk")
    env["ANDROID_SDK_ROOT"] = str(VENDOR / "android-sdk")
    env["PATH"] = os.pathsep.join([
        str(VENDOR / "jdk" / "bin"),
        str(VENDOR / "android-sdk" / "cmdline-tools" / "latest" / "bin"),
        str(VENDOR / "android-sdk" / "platform-tools"),
        env.get("PATH", ""),
    ])
    return env


def run_sdkmanager(packages: list[str]) -> None:
    sdkmanager = VENDOR / "android-sdk" / "cmdline-tools" / "latest" / "bin" / "sdkmanager"
    if not sdkmanager.exists():
        raise SystemExit(f"No existe sdkmanager: {sdkmanager}")

    env = sdkmanager_environment()
    root_arg = f"--sdk_root={VENDOR / 'android-sdk'}"
    subprocess.run(
        [str(sdkmanager), root_arg, "--licenses"],
        input=("y\n" * 200),
        text=True,
        env=env,
        check=False,
    )
    subprocess.run([str(sdkmanager), root_arg, *packages], env=env, check=True)
    chmod_executables(VENDOR / "android-sdk")


def write_manifest(args: argparse.Namespace, packages: list[str]) -> None:
    manifest = {
        "platform": "linux-x64",
        "node": args.node,
        "jdk": "temurin-17-latest",
        "android_packages": packages,
    }
    (VENDOR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prepara vendor/ para generar APKs desde Launcher EVA.")
    parser.add_argument("--node", default="auto", help="Version de Node, por ejemplo v22.12.0. Por defecto: LTS actual.")
    parser.add_argument("--platform", default="android-36", help="Android platform a instalar.")
    parser.add_argument("--build-tools", default="36.0.0", help="Android build-tools a instalar.")
    parser.add_argument("--ndk", default="27.1.12297006", help="Android NDK a instalar.")
    parser.add_argument("--cmake", default="3.22.1", help="CMake Android SDK package a instalar.")
    args = parser.parse_args(argv)

    require_linux_x64()
    VENDOR.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)

    install_node(args.node)
    install_jdk()
    install_android_commandline_tools()

    packages = [
        "platform-tools",
        f"platforms;{args.platform}",
        "build-tools;35.0.0",
        f"build-tools;{args.build_tools}",
        f"ndk;{args.ndk}",
        f"cmake;{args.cmake}",
    ]
    run_sdkmanager(packages)
    write_manifest(args, packages)
    print(f"Vendor listo en: {VENDOR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
