const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const googleServicesPath = path.join(projectRoot, "google-services.json");
const appJsonPath = path.join(projectRoot, "app.json");

function fail(message) {
  console.error(`\n[Firebase] ${message}\n`);
  process.exit(1);
}

function expectedPackageName() {
  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
    return appJson?.expo?.android?.package;
  } catch (error) {
    fail(`No puedo leer app.json: ${error.message}`);
  }
}

const expectedPackage = expectedPackageName();

if (!expectedPackage) {
  fail("app.json no define expo.android.package.");
}

if (!fs.existsSync(googleServicesPath)) {
  console.log("[Firebase] No configurado. La APK se generara sin notificaciones FCM.");
  process.exit(0);
}

let config;

try {
  config = JSON.parse(fs.readFileSync(googleServicesPath, "utf8"));
} catch (error) {
  fail(`google-services.json no es JSON valido: ${error.message}`);
}

const clients = Array.isArray(config.client) ? config.client : [];
const hasExpectedPackage = clients.some((client) => {
  return client?.client_info?.android_client_info?.package_name === expectedPackage;
});

if (!hasExpectedPackage) {
  fail(
    [
      `google-services.json no contiene el paquete Android ${expectedPackage}.`,
      "En Firebase, registra una app Android con ese package name y descarga de nuevo el archivo.",
    ].join("\n")
  );
}

console.log("[Firebase] google-services.json correcto.");
