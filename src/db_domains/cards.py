VALORES = ["as", "2", "3", "4", "5", "6", "7", "8", "9", "10", "jota", "reina", "rey"]
PALOS = ["picas", "corazones", "diamantes", "treboles"]
EXTRAS = ["joker", "joker dorado"]


class CardsRepository:
    def __init__(self, conn):
        self.conn = conn
        self.init_table()

    def init_table(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                valor TEXT NOT NULL UNIQUE,
                owner TEXT NULL
            )
        """)

        for palo in PALOS:
            for valor in VALORES:
                self.conn.execute(
                    "INSERT OR IGNORE INTO cards (valor, owner) VALUES (?, NULL)",
                    (f"{valor} de {palo}",)
                )

        for extra in EXTRAS:
            self.conn.execute(
                "INSERT OR IGNORE INTO cards (valor, owner) VALUES (?, NULL)",
                (extra,)
            )

        self.conn.commit()

    def get(self, valor: str):
        return self.conn.execute(
            "SELECT * FROM cards WHERE valor = ?",
            (valor,)
        ).fetchone()

    def get_by_owner(self, player: str):
        rows = self.conn.execute(
            "SELECT valor FROM cards WHERE owner = ? ORDER BY valor",
            (player,)
        ).fetchall()

        return [row["valor"] for row in rows]

    def get_owned(self):
        rows = self.conn.execute(
            """
            SELECT valor, owner
            FROM cards
            WHERE owner IS NOT NULL
            ORDER BY owner, valor
            """
        ).fetchall()

        return [
            {
                "valor": row["valor"],
                "owner": row["owner"],
            }
            for row in rows
        ]

    def release_owner(self, player: str):
        self.conn.execute(
            "UPDATE cards SET owner = NULL WHERE owner = ?",
            (player,),
        )
        self.conn.commit()

    def transfer_owner(self, from_player: str, to_player: str):
        cursor = self.conn.execute(
            "UPDATE cards SET owner = ? WHERE owner = ?",
            (to_player, from_player),
        )
        self.conn.commit()

        return cursor.rowcount

    def transfer_card(self, valor: str, from_player: str, to_player: str):
        card = self.get(valor)

        if card is None:
            return {
                "ok": False,
                "mensaje": f"La carta {valor} no existe.",
            }

        if card["owner"] != from_player:
            return {
                "ok": False,
                "mensaje": f"{from_player} no tiene {valor}.",
            }

        if from_player == to_player:
            return {
                "ok": False,
                "mensaje": "No puedes enviarte una carta a ti mismo.",
            }

        self.conn.execute(
            "UPDATE cards SET owner = ? WHERE valor = ?",
            (to_player, valor),
        )
        self.conn.commit()

        return {
            "ok": True,
            "mensaje": f"{from_player} envía {valor} a {to_player}.",
            "accion": {
                "tipo": "CARTA",
                "destinatario": to_player,
                "valor": valor,
            },
        }

    def assign(self, valor: str, player: str):
        card = self.get(valor)

        if card is None:
            return {
                "ok": False,
                "mensaje": f"La carta {valor} no existe.",
            }

        current_owner = card["owner"]

        if current_owner == player:
            return {
                "ok": False,
                "mensaje": f"{player} ya tiene esta carta.",
            }

        if current_owner is not None:
            return {
                "ok": False,
                "mensaje": f"Esta carta ya tiene como dueño {current_owner}.",
            }

        self.conn.execute(
            "UPDATE cards SET owner = ? WHERE valor = ?",
            (player, valor)
        )
        self.conn.commit()

        return {
            "ok": True,
            "mensaje": f"Enviando {valor} a {player}.",
            "accion": {
                "tipo": "CARTA",
                "destinatario": player,
                "valor": valor,
            }
        }
