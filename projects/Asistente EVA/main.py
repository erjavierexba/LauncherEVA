import asyncio

from src.app_context import create_app_context, set_app_context
from src.eva import start_eva
from src.ws_server import start_ws_server
from src.web_server import start_web_server


async def main():
    context = create_app_context()
    set_app_context(context)

    await asyncio.gather(
        start_ws_server(context),
        start_web_server(context),
        start_eva(context),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nCerrando EVA.")
