from itertools import combinations, product

RANKS = {
    "as": 1,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    "jota": 11,
    "reina": 12,
    "rey": 13,
}

RANK_LABELS = {
    1: "as",
    11: "jota",
    12: "reina",
    13: "rey",
}

SUITS = ("picas", "corazones", "diamantes", "treboles")
RED_SUITS = {"corazones", "diamantes"}
BLACK_SUITS = {"picas", "treboles"}
FIGURE_RANKS = {11, 12, 13}
NUMBER_RANKS = set(range(1, 11))
MAX_RESULTS = 80


def evaluate_door(cards: list[dict], rules: dict):
    parsed_cards = [
        card
        for card in (parse_card(raw) for raw in cards)
        if card is not None
    ]
    filtered_cards = apply_filters(parsed_cards, rules)
    combination = rules.get("combination", "pair")

    if combination == "pair":
        matches = same_rank_matches(filtered_cards, 2, rules)
    elif combination == "three":
        matches = same_rank_matches(filtered_cards, 3, rules)
    elif combination == "four":
        matches = same_rank_matches(filtered_cards, 4, rules)
    elif combination == "full_house":
        matches = full_house_matches(filtered_cards, rules)
    elif combination == "straight":
        matches = straight_matches(
            filtered_cards,
            clamp_int(rules.get("straightLength"), default=4, minimum=2, maximum=13),
            rules,
        )
    elif combination == "flush":
        matches = flush_matches(
            filtered_cards,
            clamp_int(rules.get("groupSize"), default=4, minimum=2, maximum=13),
            rules,
        )
    elif combination == "at_least":
        matches = at_least_matches(
            filtered_cards,
            clamp_int(rules.get("groupSize"), default=3, minimum=1, maximum=13),
            clamp_int(rules.get("atLeastCount"), default=3, minimum=1, maximum=13),
            rules.get("atLeastKind", "odd"),
            rules,
        )
    else:
        matches = []

    return {
        "ok": True,
        "matches": matches[:MAX_RESULTS],
        "matchCount": len(matches),
        "truncated": len(matches) > MAX_RESULTS,
    }


def parse_card(raw: dict):
    value = raw.get("valor")
    owner = raw.get("owner")

    if not isinstance(value, str) or not isinstance(owner, str):
        return None

    if value in ("joker", "joker dorado"):
        return {
            "valor": value,
            "owner": owner,
            "rank": None,
            "rankLabel": "joker",
            "suit": None,
            "color": None,
            "parity": None,
            "isFigure": False,
            "isNumber": False,
            "isJoker": True,
        }

    if " de " not in value:
        return None

    rank_text, suit = value.split(" de ", 1)
    rank = RANKS.get(rank_text)

    if rank is None:
        return None

    is_figure = rank in FIGURE_RANKS
    is_number = rank in NUMBER_RANKS

    return {
        "valor": value,
        "owner": owner,
        "rank": rank,
        "rankLabel": RANK_LABELS.get(rank, str(rank)),
        "suit": suit,
        "color": "red" if suit in RED_SUITS else "black",
        "parity": "even" if is_number and rank % 2 == 0 else "odd" if is_number else None,
        "isFigure": is_figure,
        "isNumber": is_number,
        "isJoker": False,
    }


def apply_filters(cards: list[dict], rules: dict):
    color = rules.get("color", "any")
    parity = rules.get("parity", "any")
    rank_filter = rules.get("rankFilter", "any")
    suit_mode = rules.get("suitMode", "any")
    suit = rules.get("suit")

    filtered = cards

    if color in ("red", "black"):
        filtered = [
            card
            for card in filtered
            if card["isJoker"] or card["color"] == color
        ]

    if parity in ("even", "odd"):
        filtered = [
            card
            for card in filtered
            if card["isJoker"] or card["parity"] == parity
        ]

    if rank_filter == "figures":
        filtered = [
            card
            for card in filtered
            if card["isJoker"] or card["isFigure"]
        ]

    if suit_mode == "specific" and suit:
        filtered = [
            card
            for card in filtered
            if card["isJoker"] or card["suit"] == suit
        ]

    return filtered


def same_rank_matches(cards: list[dict], size: int, rules: dict):
    matches = []
    ranks = allowed_ranks(rules)

    for rank in ranks:
        real_cards = [card for card in cards if not card["isJoker"] and card["rank"] == rank]
        jokers = [card for card in cards if card["isJoker"]]

        for joker_count in range(0, min(len(jokers), size) + 1):
            real_count = size - joker_count

            if len(real_cards) < real_count:
                continue

            for real_combo in combinations(real_cards, real_count):
                for joker_combo in combinations(jokers, joker_count):
                    for joker_suit in joker_suit_options(real_combo, rules):
                        combo = [
                            *real_combo,
                            *materialize_jokers(joker_combo, rank=rank, suit=joker_suit, rules=rules),
                        ]

                        if accepts_combo(combo, rules):
                            matches.append(format_match(combo, RANK_LABELS.get(rank, str(rank))))

    return unique_matches(matches)


def full_house_matches(cards: list[dict], rules: dict):
    matches = []
    ranks = allowed_ranks(rules)

    for triple_rank in ranks:
        for pair_rank in ranks:
            if pair_rank == triple_rank:
                continue

            for triple in rank_group_options(cards, triple_rank, 3, rules):
                used_ids = {combo_source_id(card) for card in triple}
                remaining_cards = [
                    card
                    for card in cards
                    if card_id(card) not in used_ids
                ]

                for pair in rank_group_options(remaining_cards, pair_rank, 2, rules):
                    combo = [*triple, *pair]

                    if accepts_combo(combo, rules):
                        matches.append(format_match(combo, "full house"))

    return unique_matches(matches)


def straight_matches(cards: list[dict], length: int, rules: dict):
    matches = []
    ranks = [rank for rank in allowed_ranks(rules) if rank in NUMBER_RANKS]

    for start in range(1, 15 - length):
        straight_ranks = list(range(start, start + length))

        if not all(rank in ranks for rank in straight_ranks):
            continue

        options = [rank_group_options(cards, rank, 1, rules) for rank in straight_ranks]

        if any(not option for option in options):
            continue

        for combo_groups in product(*options):
            combo = [card for group in combo_groups for card in group]
            source_ids = [combo_source_id(card) for card in combo]

            if len(source_ids) != len(set(source_ids)):
                continue

            if accepts_combo(combo, rules):
                matches.append(format_match(combo, "escalera"))

    return unique_matches(matches)


def flush_matches(cards: list[dict], size: int, rules: dict):
    matches = []
    suit_mode = rules.get("suitMode", "any")
    forced_suit = rules.get("suit")

    suits = [forced_suit] if suit_mode == "specific" and forced_suit else SUITS

    for suit in suits:
        real_cards = [
            card
            for card in cards
            if not card["isJoker"] and card["suit"] == suit
        ]
        jokers = [card for card in cards if card["isJoker"]]

        for joker_count in range(0, min(len(jokers), size) + 1):
            real_count = size - joker_count

            if len(real_cards) < real_count:
                continue

            for real_combo in combinations(real_cards, real_count):
                for joker_combo in combinations(jokers, joker_count):
                    combo = [*real_combo, *materialize_jokers(joker_combo, suit=suit, rules=rules)]

                    if accepts_combo(combo, rules):
                        matches.append(format_match(combo, f"palo {suit}"))

    return unique_matches(matches)


def at_least_matches(cards: list[dict], size: int, minimum: int, kind: str, rules: dict):
    matches = []
    if minimum > size:
        return matches

    for combo in combinations(cards, size):
        if accepts_at_least(combo, minimum, kind) and accepts_combo(combo, rules):
            matches.append(format_match(combo, at_least_label(minimum, kind)))

    return unique_matches(matches)


def accepts_at_least(combo, minimum: int, kind: str):
    if kind == "same_suit":
        suit_counts = {}
        jokers = 0
        for card in combo:
            if card["isJoker"]:
                jokers += 1
            elif card["suit"]:
                suit_counts[card["suit"]] = suit_counts.get(card["suit"], 0) + 1
        return any(count + jokers >= minimum for count in suit_counts.values()) or jokers >= minimum

    return sum(1 for card in combo if card["isJoker"] or card_matches_kind(card, kind)) >= minimum


def card_matches_kind(card: dict, kind: str):
    if kind == "odd":
        return card["parity"] == "odd"
    if kind == "even":
        return card["parity"] == "even"
    if kind == "figures":
        return card["isFigure"]
    if kind == "red":
        return card["color"] == "red"
    if kind == "black":
        return card["color"] == "black"
    return True


def at_least_label(minimum: int, kind: str):
    labels = {
        "odd": "impares",
        "even": "pares",
        "figures": "figuras",
        "red": "rojas",
        "black": "negras",
        "same_suit": "mismo palo",
    }
    return f"al menos {minimum} {labels.get(kind, 'cartas válidas')}"


def rank_group_options(cards: list[dict], rank: int, size: int, rules: dict):
    real_cards = [card for card in cards if not card["isJoker"] and card["rank"] == rank]
    jokers = [card for card in cards if card["isJoker"]]
    options = []

    for joker_count in range(0, min(len(jokers), size) + 1):
        real_count = size - joker_count

        if len(real_cards) < real_count:
            continue

        for real_combo in combinations(real_cards, real_count):
            for joker_combo in combinations(jokers, joker_count):
                for joker_suit in joker_suit_options(real_combo, rules):
                    combo = [
                        *real_combo,
                        *materialize_jokers(joker_combo, rank=rank, suit=joker_suit, rules=rules),
                    ]

                    if accepts_combo(combo, rules):
                        options.append(combo)

    return options


def materialize_jokers(jokers, rank=None, suit=None, rules=None):
    rules = rules or {}
    forced_suit = suit or rules.get("suit")
    color = rules.get("color", "any")

    if forced_suit is None:
        if color == "red":
            forced_suit = "corazones"
        elif color == "black":
            forced_suit = "picas"
        else:
            forced_suit = "picas"

    materialized = []

    for joker in jokers:
        materialized.append({
            **joker,
            "sourceId": card_id(joker),
            "rank": rank,
            "rankLabel": RANK_LABELS.get(rank, str(rank)) if rank is not None else "joker",
            "suit": forced_suit,
            "color": "red" if forced_suit in RED_SUITS else "black",
            "parity": (
                "even" if rank in NUMBER_RANKS and rank % 2 == 0
                else "odd" if rank in NUMBER_RANKS
                else None
            ),
            "isFigure": rank in FIGURE_RANKS if rank is not None else False,
            "isNumber": rank in NUMBER_RANKS if rank is not None else False,
            "jokerAs": {
                "rank": rank,
                "suit": forced_suit,
            },
        })

    return materialized


def joker_suit_options(real_combo, rules: dict):
    suit_mode = rules.get("suitMode", "any")
    forced_suit = rules.get("suit")

    if suit_mode == "specific" and forced_suit:
        return [forced_suit]

    if suit_mode == "same":
        real_suits = {card["suit"] for card in real_combo if card["suit"]}

        if len(real_suits) == 1:
            return list(real_suits)

        if len(real_suits) > 1:
            return []

        return list(SUITS)

    return [None]


def accepts_combo(combo, rules: dict):
    suit_mode = rules.get("suitMode", "any")

    if suit_mode == "same" and len({card["suit"] for card in combo}) != 1:
        return False

    return True


def allowed_ranks(rules: dict):
    parity = rules.get("parity", "any")
    rank_filter = rules.get("rankFilter", "any")

    if rank_filter == "figures":
        return sorted(FIGURE_RANKS)

    if parity == "even":
        return [rank for rank in sorted(NUMBER_RANKS) if rank % 2 == 0]

    if parity == "odd":
        return [rank for rank in sorted(NUMBER_RANKS) if rank % 2 == 1]

    return sorted(NUMBER_RANKS | FIGURE_RANKS)


def format_match(combo, label: str):
    cards = sorted(combo, key=lambda card: (
        card["rank"] if card["rank"] is not None else 99,
        card["suit"] or "",
        card["owner"],
        card["valor"],
    ))

    return {
        "label": label,
        "players": sorted({card["owner"] for card in cards}),
        "cards": [
            {
                "owner": card["owner"],
                "valor": card["valor"],
                "rank": card["rank"],
                "rankLabel": card["rankLabel"],
                "suit": card["suit"],
                "color": card["color"],
                "parity": card["parity"],
                "jokerAs": card.get("jokerAs"),
            }
            for card in cards
        ],
    }


def unique_matches(matches: list[dict]):
    seen = set()
    unique = []

    for match in matches:
        key = tuple(sorted(
            (
                card["owner"],
                card["valor"],
                card["jokerAs"]["rank"] if card.get("jokerAs") else card["rank"],
                card["jokerAs"]["suit"] if card.get("jokerAs") else card["suit"],
            )
            for card in match["cards"]
        ))

        if key in seen:
            continue

        seen.add(key)
        unique.append(match)

    return unique


def card_id(card: dict):
    return f"{card['owner']}:{card['valor']}"


def combo_source_id(card: dict):
    return card.get("sourceId") or card_id(card)


def clamp_int(value, default: int, minimum: int, maximum: int):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default

    return min(max(parsed, minimum), maximum)
