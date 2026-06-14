import random
import unicodedata


RESULT_COUNT = 10

HUMAN_NAME_SETS = {
    "es": {
        "label": "España",
        "female": [
            "Lucia", "Sofia", "Martina", "Valeria", "Maria", "Julia", "Paula",
            "Emma", "Carmen", "Alba", "Irene", "Claudia", "Noa", "Vega",
            "Aitana", "Nora", "Ines", "Marta", "Sara", "Lola",
            "Laura", "Elena", "Cristina", "Raquel", "Andrea", "Natalia", "Alicia",
            "Beatriz", "Rocio", "Marina", "Teresa", "Silvia", "Patricia", "Eva",
            "Ana", "Carla", "Leire", "Ariadna", "Miriam", "Ainhoa", "Nerea",
            "Blanca", "Elsa", "Olivia", "Jimena", "Candela", "Aroa", "Lara",
        ],
        "male": [
            "Hugo", "Mateo", "Martin", "Lucas", "Leo", "Daniel", "Alejandro",
            "Pablo", "Manuel", "Alvaro", "Adrian", "David", "Mario", "Diego",
            "Javier", "Marcos", "Nicolas", "Bruno", "Izan", "Sergio",
            "Carlos", "Miguel", "Jose", "Antonio", "Francisco", "Ruben", "Ivan",
            "Raul", "Victor", "Jorge", "Alberto", "Gonzalo", "Jaime", "Oscar",
            "Hector", "Guillermo", "Enrique", "Gabriel", "Samuel", "Tomas",
            "Rodrigo", "Cesar", "Ignacio", "Rafael", "Lorenzo", "Dario",
        ],
        "surnames": [
            "Garcia", "Rodriguez", "Gonzalez", "Fernandez", "Lopez", "Martinez",
            "Sanchez", "Perez", "Gomez", "Martin", "Jimenez", "Ruiz", "Hernandez",
            "Diaz", "Moreno", "Alvarez", "Romero", "Navarro", "Torres", "Vargas",
            "Ramos", "Gil", "Serrano", "Molina", "Blanco", "Castro", "Ortiz",
            "Rubio", "Marin", "Sanz", "Iglesias", "Medina", "Cortes", "Castillo",
            "Santos", "Lozano", "Guerrero", "Cano", "Prieto", "Mendez", "Cruz",
            "Calvo", "Vidal", "Leon", "Herrera", "Peña", "Flores", "Cabrera",
        ],
    },
    "mx": {
        "label": "Mexico",
        "female": [
            "Valentina", "Regina", "Camila", "Ximena", "Renata", "Sofia",
            "Maria Jose", "Daniela", "Luciana", "Fernanda", "Montserrat",
            "Isabella", "Andrea", "Paola", "Jimena", "Natalia",
            "Guadalupe", "Alejandra", "Mariana", "Carolina", "Ana Sofia",
            "Victoria", "Emilia", "Romina", "Salma", "Abril", "Fatima",
            "Danna", "Aitana", "Miranda", "Alexa", "Valeria", "Mia",
            "Paulina", "Ivanna", "Renata Sofia", "Adriana", "Bianca",
            "Luna", "Frida", "Samantha", "Elena",
        ],
        "male": [
            "Santiago", "Mateo", "Sebastian", "Leonardo", "Matias", "Emiliano",
            "Diego", "Miguel Angel", "Alexander", "Gael", "Daniel", "Jesus",
            "Angel", "Rodrigo", "Andres", "Iker",
            "Jose Luis", "Juan Pablo", "Carlos", "Fernando", "Eduardo",
            "Ricardo", "Javier", "Rafael", "Luis Fernando", "Emmanuel",
            "Nicolas", "Dylan", "Alan", "Hector", "Omar", "Emilio", "Axel",
            "Mauricio", "Francisco", "Antonio", "Bruno", "Samuel", "Adrian",
            "Joaquin", "Ivan", "Marco",
        ],
        "surnames": [
            "Hernandez", "Garcia", "Martinez", "Lopez", "Gonzalez", "Perez",
            "Rodriguez", "Sanchez", "Ramirez", "Cruz", "Flores", "Gomez",
            "Morales", "Vazquez", "Reyes", "Jimenez",
            "Torres", "Diaz", "Gutierrez", "Ruiz", "Mendoza", "Aguilar",
            "Ortiz", "Castillo", "Romero", "Moreno", "Alvarez", "Chavez",
            "Rivera", "Ramos", "Herrera", "Medina", "Silva", "Castro",
            "Vargas", "Fernandez", "Munoz", "Rojas", "Salazar", "Delgado",
            "Guerrero", "Navarro",
        ],
    },
    "fr": {
        "label": "Francia",
        "female": [
            "Emma", "Louise", "Jade", "Alice", "Chloe", "Lina", "Lea", "Mila",
            "Manon", "Rose", "Anna", "Ines", "Camille", "Ambre", "Juliette",
            "Jeanne", "Lucie", "Agathe", "Clara", "Eva", "Nina", "Zoe", "Sarah",
            "Margaux", "Leonie", "Romy", "Lou", "Iris", "Lena", "Maelys",
            "Charlotte", "Capucine", "Noemie", "Adele", "Elise", "Lola",
            "Mathilde", "Oceane", "Anais", "Victoire", "Clemence",
        ],
        "male": [
            "Gabriel", "Leo", "Raphael", "Louis", "Arthur", "Jules", "Adam",
            "Mael", "Lucas", "Hugo", "Noah", "Gabin", "Sacha", "Ethan", "Paul",
            "Nathan", "Tom", "Liam", "Aaron", "Timeo", "Nolan", "Malo", "Noe",
            "Eden", "Victor", "Leon", "Mathis", "Antoine", "Baptiste", "Maxime",
            "Clement", "Romain", "Adrien", "Gaspard", "Valentin", "Simon",
            "Theodore", "Axel", "Enzo", "Robin", "Oscar",
        ],
        "surnames": [
            "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard",
            "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent",
            "Lefevre", "Michel", "Garcia",
            "David", "Bertrand", "Roux", "Vincent", "Fournier", "Morel",
            "Girard", "Andre", "Lefevre", "Mercier", "Dupont", "Lambert",
            "Bonnet", "Francois", "Martinez", "Legrand", "Garnier", "Faure",
            "Rousseau", "Blanc", "Guerin", "Muller", "Henry", "Roussel",
            "Nicolas", "Perrin",
        ],
    },
    "gb": {
        "label": "Inglaterra",
        "female": [
            "Olivia", "Amelia", "Isla", "Ava", "Mia", "Ivy", "Lily", "Freya",
            "Florence", "Grace", "Willow", "Elsie", "Evie", "Sophia", "Sienna",
            "Emily", "Ella", "Poppy", "Ruby", "Rosie", "Daisy", "Isabelle",
            "Millie", "Matilda", "Evelyn", "Harper", "Maya", "Sophie", "Alice",
            "Jessica", "Chloe", "Phoebe", "Maisie", "Aurora", "Arabella",
            "Imogen", "Erin", "Thea", "Molly", "Zara", "Hannah",
        ],
        "male": [
            "Oliver", "George", "Arthur", "Noah", "Muhammad", "Leo", "Oscar",
            "Harry", "Archie", "Jack", "Henry", "Charlie", "Freddie", "Thomas",
            "Theo",
            "Alfie", "Jacob", "William", "James", "Joshua", "Ethan", "Max",
            "Isaac", "Edward", "Joseph", "Teddy", "Finley", "Adam", "Alexander",
            "Benjamin", "Samuel", "Dylan", "Louis", "Mason", "Rory", "Harrison",
            "Logan", "Reuben", "Toby", "Sebastian", "Elliot",
        ],
        "surnames": [
            "Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson",
            "Davies", "Patel", "Robinson", "Wright", "Thompson", "Evans",
            "Walker", "White",
            "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke", "Lewis",
            "Mason", "Mitchell", "Cox", "Campbell", "Stewart", "Morris",
            "Morgan", "Hughes", "Edwards", "Hill", "Moore", "Clark", "Harris",
            "Cooper", "King", "Baker", "Harrison", "Turner", "Carter",
        ],
    },
    "jp": {
        "label": "Japon",
        "female": [
            "Yui", "Aoi", "Hina", "Sakura", "Rin", "Mei", "Akari", "Mio",
            "Ichika", "Yuna", "Koharu", "Nana", "Saki", "Hikari", "Hana",
            "Riko", "Miyu", "Ayaka", "Haruka", "Yuka", "Noa", "Sara", "Kanna",
            "Hinata", "Airi", "Rina", "Nanami", "Kaede", "Miku", "Yume",
            "Honoka", "Misaki", "Ayane", "Ema", "Natsuki", "Shiori", "Mao",
            "Reina", "Asuka", "Sumire", "Risa",
        ],
        "male": [
            "Haruto", "Sota", "Yuto", "Ren", "Minato", "Riku", "Haru", "Kaito",
            "Hinata", "Yamato", "Itsuki", "Aoto", "Sora", "Daiki", "Toma",
            "Ryota", "Yuma", "Hayato", "Takumi", "Koki", "Shota", "Ryo",
            "Tsubasa", "Kenta", "Kazuki", "Naoki", "Akira", "Hiroto", "Sosuke",
            "Yuki", "Reo", "Taiga", "Kosei", "Masaki", "Keita", "Shun",
            "Haruki", "Asahi", "Takeru", "Natsuki", "Rento",
        ],
        "surnames": [
            "Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito",
            "Yamamoto", "Nakamura", "Kobayashi", "Kato", "Yoshida", "Yamada",
            "Sasaki", "Yamaguchi", "Matsumoto",
            "Inoue", "Kimura", "Hayashi", "Shimizu", "Saito", "Sakamoto",
            "Mori", "Abe", "Ikeda", "Hashimoto", "Ishikawa", "Yamazaki",
            "Ogawa", "Ishii", "Hasegawa", "Goto", "Okada", "Fujita", "Maeda",
            "Endo", "Aoki", "Murakami", "Kondo", "Saito", "Fukuda", "Ota",
        ],
    },
}

FANTASY_RACES = {
    "humano": {
        "prefixes": ["Ald", "Bel", "Cor", "Dar", "El", "Fer", "Gar", "Mar", "Nor", "Val"],
        "middles": ["a", "e", "i", "o", "ar", "en", "or", "is", "an", "el"],
        "suffixes": ["dan", "ric", "mon", "sen", "tor", "ven", "lan", "mir", "ron", "del"],
        "female_suffixes": ["a", "ia", "ela", "ina", "ara", "ene", "ora", "isa", "alia", "ira"],
        "male_suffixes": ["dan", "ric", "mon", "sen", "tor", "ven", "lan", "mir", "ron", "del"],
    },
    "elfo": {
        "prefixes": ["Ael", "Eli", "Lia", "Syl", "Thae", "Faen", "Iril", "Naer", "Vael", "Cael"],
        "middles": ["la", "ri", "na", "the", "wen", "riel", "mir", "syl", "ae", "ith"],
        "suffixes": ["dor", "iel", "wen", "thas", "rion", "lith", "mir", "ndel", "las", "rian"],
        "female_suffixes": ["iel", "wen", "lith", "riel", "thia", "syl", "nara", "mir", "lian", "ae"],
        "male_suffixes": ["dor", "thas", "rion", "ndel", "las", "rian", "mir", "ion", "thel", "dil"],
    },
    "orco": {
        "prefixes": ["Gor", "Brak", "Urz", "Mog", "Thok", "Durg", "Krag", "Ruk", "Zog", "Grum"],
        "middles": ["", "a", "u", "gar", "ruk", "mok", "z", "ag", "ur", "ok"],
        "suffixes": ["nak", "grom", "thak", "bur", "zug", "rash", "mog", "dush", "kar", "gor"],
        "female_suffixes": ["ra", "sha", "gra", "zug", "nash", "ka", "dush", "mog", "gara", "bur"],
        "male_suffixes": ["nak", "grom", "thak", "bur", "zug", "rash", "mog", "dush", "kar", "gor"],
    },
    "enano": {
        "prefixes": ["Brom", "Dain", "Thrain", "Kili", "Borin", "Dur", "Gim", "Nori", "Tor", "Fund"],
        "middles": ["", "in", "ar", "or", "un", "grim", "dr", "al", "um", "gar"],
        "suffixes": ["bar", "din", "grim", "rik", "dun", "li", "or", "kar", "bur", "son"],
        "female_suffixes": ["a", "hilda", "dis", "bera", "gret", "lina", "run", "dora", "grid", "mora"],
        "male_suffixes": ["bar", "din", "grim", "rik", "dun", "li", "or", "kar", "bur", "son"],
    },
    "dragonborn": {
        "prefixes": ["Arj", "Bal", "Drax", "Ghesh", "Hes", "Kriv", "Med", "Nad", "Patr", "Rhog"],
        "middles": ["", "a", "ar", "esh", "ix", "oth", "ur", "ax", "ir", "ash"],
        "suffixes": ["han", "ar", "ix", "oth", "rax", "esh", "kar", "thar", "vyr", "dan"],
        "female_suffixes": ["ira", "ashi", "ora", "thia", "vra", "esh", "ari", "kira", "sora", "yra"],
        "male_suffixes": ["han", "ar", "ix", "oth", "rax", "esh", "kar", "thar", "vyr", "dan"],
    },
    "gnomo": {
        "prefixes": ["Alv", "Bim", "Coggle", "Dabb", "Elly", "Fizz", "Glim", "Nim", "Pip", "Wrenn"],
        "middles": ["", "i", "o", "wick", "bin", "fiz", "lo", "nim", "sprock", "tink"],
        "suffixes": ["wick", "bin", "fizz", "nock", "len", "pip", "mop", "biddle", "tock", "nim"],
        "female_suffixes": ["ella", "ina", "belle", "mira", "nissa", "pina", "lina", "fizz", "tina", "nock"],
        "male_suffixes": ["wick", "bin", "fizz", "nock", "len", "pip", "mop", "biddle", "tock", "nim"],
    },
    "goliat": {
        "prefixes": ["Auk", "Eglath", "Gae", "Kav", "Keo", "Mav", "Nalla", "Orilo", "Thul", "Vim"],
        "middles": ["", "a", "an", "uk", "ath", "or", "un", "ak", "oa", "el"],
        "suffixes": ["an", "ak", "ath", "gor", "kan", "thar", "uk", "morn", "var", "dun"],
        "female_suffixes": ["a", "oa", "ani", "atha", "ka", "mora", "nalla", "vora", "una", "ela"],
        "male_suffixes": ["an", "ak", "ath", "gor", "kan", "thar", "uk", "morn", "var", "dun"],
    },
    "mediano": {
        "prefixes": ["Al", "Bel", "Cor", "Dora", "Eli", "Finn", "Milo", "Nora", "Pip", "Tilly"],
        "middles": ["", "a", "e", "i", "o", "li", "lo", "per", "wise", "bar"],
        "suffixes": ["bin", "wise", "foot", "bur", "lo", "per", "kin", "wick", "bel", "ton"],
        "female_suffixes": ["a", "ia", "ella", "ina", "belle", "wise", "per", "li", "nora", "rose"],
        "male_suffixes": ["bin", "wise", "foot", "bur", "lo", "per", "kin", "wick", "bel", "ton"],
    },
    "medio_elfo": {
        "prefixes": ["Aren", "Cala", "Dari", "Ela", "Kael", "Lora", "Miren", "Neria", "Sovel", "Tarin"],
        "middles": ["", "a", "el", "ia", "or", "riel", "an", "is", "ven", "th"],
        "suffixes": ["dan", "iel", "ren", "thas", "mir", "las", "wen", "ron", "dil", "sor"],
        "female_suffixes": ["ia", "iel", "wen", "lora", "nara", "riel", "mira", "syl", "ena", "thia"],
        "male_suffixes": ["dan", "ren", "thas", "mir", "las", "ron", "dil", "sor", "ven", "kael"],
    },
    "medio_orco": {
        "prefixes": ["Bar", "Drek", "Gar", "Hruk", "Keth", "Mara", "Org", "Rogar", "Shag", "Tor"],
        "middles": ["", "a", "en", "gar", "ok", "or", "rak", "un", "ur", "z"],
        "suffixes": ["dan", "grom", "kar", "nak", "ren", "rok", "thar", "ven", "zug", "gor"],
        "female_suffixes": ["a", "ara", "gra", "ka", "nara", "sha", "thia", "vra", "zug", "ren"],
        "male_suffixes": ["dan", "grom", "kar", "nak", "ren", "rok", "thar", "ven", "zug", "gor"],
    },
    "tiefling": {
        "prefixes": ["Ak", "Am", "Bry", "Cri", "Dama", "Ek", "Kair", "Leu", "Mord", "Nyx"],
        "middles": ["", "a", "ai", "ar", "eth", "ia", "is", "or", "ra", "th"],
        "suffixes": ["mon", "ius", "rix", "thos", "zar", "iel", "vex", "dros", "ira", "xan"],
        "female_suffixes": ["ira", "iel", "vex", "thia", "nyx", "aria", "zar", "risa", "lith", "mora"],
        "male_suffixes": ["mon", "ius", "rix", "thos", "zar", "dros", "xan", "kair", "vyr", "mord"],
    },
    "ciudad": {
        "prefixes": ["Ald", "Bruma", "Cal", "Dorna", "Eld", "Faro", "Gris", "Luna", "Niebla", "Roca"],
        "middles": ["", "de", "del", "la", "mar", "mont", "val", "tor", "sur", "alto"],
        "suffixes": ["haven", "dor", "burgo", "marca", "val", "torre", "puerto", "senda", "mora", "guardia"],
    },
}

FANTASY_RACES.update({
    "aarakocra": {
        "prefixes": ["Aka", "Cree", "Ikki", "Kara", "Kree", "Paka", "Qiri", "Raka", "Tika", "Ziri"],
        "middles": ["", "a", "ee", "i", "ki", "ra", "ri", "ta", "ti", "zi"],
        "suffixes": ["kaw", "ree", "tal", "kir", "kaa", "rik", "sha", "tik", "zar", "qik"],
        "female_suffixes": ["ree", "sha", "ria", "tika", "kira", "ziri", "qia", "nara", "liri", "saa"],
        "male_suffixes": ["kaw", "tal", "kir", "rik", "tik", "zar", "qik", "rok", "kar", "raak"],
    },
    "aasimar": {
        "prefixes": ["Auri", "Celes", "Eli", "Halo", "Iri", "Lumi", "Ser", "Sola", "Theo", "Uri"],
        "middles": ["", "a", "el", "ia", "iel", "or", "ra", "sar", "th", "ven"],
        "suffixes": ["el", "ion", "iel", "ara", "dor", "iel", "or", "thas", "ven", "riel"],
        "female_suffixes": ["a", "ara", "ia", "iel", "lina", "riel", "sera", "thia", "vella", "yra"],
        "male_suffixes": ["el", "ion", "dor", "or", "thas", "ven", "riel", "dan", "sor", "mael"],
    },
    "bugbear": {
        "prefixes": ["Barg", "Drog", "Ghar", "Grub", "Hrag", "Klag", "Murg", "Rag", "Thog", "Vrag"],
        "middles": ["", "a", "g", "ok", "rag", "ruk", "um", "ur", "z", "og"],
        "suffixes": ["bash", "grak", "grot", "mug", "nak", "rag", "ruk", "thok", "zug", "zog"],
    },
    "centauro": {
        "prefixes": ["Aster", "Bront", "Chiron", "Daph", "Eury", "Hyl", "Kall", "Lyk", "Mel", "Ther"],
        "middles": ["", "a", "ae", "ia", "ion", "or", "os", "ra", "the", "ys"],
        "suffixes": ["on", "os", "ia", "ra", "thea", "ion", "dor", "kos", "mir", "nae"],
        "female_suffixes": ["a", "ia", "thea", "ra", "nae", "dora", "lyra", "mira", "eia", "sara"],
        "male_suffixes": ["on", "os", "ion", "dor", "kos", "mir", "thos", "ron", "ther", "lyk"],
    },
    "changeling": {
        "prefixes": ["Ash", "Blank", "Dusk", "Echo", "Grey", "Lark", "Mist", "Noon", "Shade", "Veil"],
        "middles": ["", "a", "en", "i", "is", "or", "ra", "ren", "ul", "wyn"],
        "suffixes": ["ren", "veil", "wyn", "shade", "morn", "len", "sil", "var", "dawn", "mask"],
    },
    "hada": {
        "prefixes": ["Bri", "Dew", "Fae", "Lili", "Mira", "Nim", "Pixa", "Ros", "Twi", "Wisp"],
        "middles": ["", "a", "bel", "dew", "ia", "li", "mi", "ra", "tin", "wyn"],
        "suffixes": ["bell", "bloom", "dew", "flick", "lily", "moth", "pix", "spark", "wyn", "whim"],
        "female_suffixes": ["bell", "bloom", "dew", "ia", "lily", "mira", "pix", "rose", "wyn", "whim"],
        "male_suffixes": ["flick", "moth", "spark", "thorn", "whim", "wyn", "pip", "briar", "dew", "nix"],
    },
    "firbolg": {
        "prefixes": ["Bryn", "Cairn", "Dalan", "Eog", "Fenn", "Glen", "Harth", "Moss", "Rowan", "Tarn"],
        "middles": ["", "a", "an", "en", "eth", "mor", "or", "ran", "un", "wyn"],
        "suffixes": ["bark", "fen", "glen", "mor", "root", "stone", "thorn", "wald", "wood", "wyn"],
    },
    "genasi": {
        "prefixes": ["Ash", "Breeze", "Ember", "Gale", "Mica", "Onyx", "River", "Siro", "Terra", "Zeph"],
        "middles": ["", "a", "ai", "en", "ia", "ir", "or", "ra", "rin", "ul"],
        "suffixes": ["ash", "drift", "flare", "gale", "morn", "stone", "surge", "tide", "wyn", "zeph"],
    },
    "giff": {
        "prefixes": ["Bram", "Cort", "Dun", "Harr", "Major", "Pold", "Reg", "Tav", "Wex", "Yard"],
        "middles": ["", "a", "er", "ing", "ley", "or", "ton", "wick", "win", "worth"],
        "suffixes": ["by", "field", "ford", "ley", "ton", "wick", "win", "worth", "son", "well"],
    },
    "gith": {
        "prefixes": ["Azer", "Dak", "Gish", "Kith", "Qel", "Raak", "Sarth", "Vrak", "Xer", "Zerth"],
        "middles": ["", "a", "ak", "ith", "ra", "rek", "th", "ul", "za", "zer"],
        "suffixes": ["ak", "ath", "ek", "ith", "ra", "rek", "th", "ul", "za", "zer"],
    },
    "goblin": {
        "prefixes": ["Bik", "Fizz", "Grib", "Nix", "Riz", "Skab", "Snit", "Tik", "Waz", "Zib"],
        "middles": ["", "a", "ik", "ix", "ob", "og", "uk", "z", "za", "zi"],
        "suffixes": ["bit", "gob", "grit", "nak", "nix", "snik", "tik", "waz", "zib", "zug"],
    },
    "harengon": {
        "prefixes": ["Bram", "Bun", "Clover", "Dandel", "Fennel", "Hop", "Merri", "Nettle", "Pip", "Thistle"],
        "middles": ["", "a", "bel", "bit", "en", "er", "foot", "kin", "li", "wick"],
        "suffixes": ["bell", "bit", "foot", "hop", "kin", "leaf", "pip", "run", "wick", "whisk"],
    },
    "hobgoblin": {
        "prefixes": ["Az", "Darg", "Khar", "Kren", "Mag", "Ruk", "Targ", "Vaz", "Zan", "Zor"],
        "middles": ["", "a", "ar", "dar", "ek", "gar", "or", "rak", "uk", "z"],
        "suffixes": ["dar", "gak", "gar", "kar", "rak", "rek", "thar", "vash", "zun", "zor"],
    },
    "kenku": {
        "prefixes": ["Click", "Creak", "Croak", "Ink", "Knock", "Quill", "Rattle", "Scratch", "Tock", "Whistle"],
        "middles": ["", "a", "cl", "ik", "ka", "ki", "ra", "ri", "tik", "tok"],
        "suffixes": ["clack", "caw", "click", "ink", "knock", "quill", "scratch", "tock", "whisk", "whistle"],
    },
    "kobold": {
        "prefixes": ["Bik", "Dib", "Gix", "Kip", "Meep", "Nok", "Rik", "Snik", "Tik", "Yip"],
        "middles": ["", "a", "i", "ik", "ix", "ka", "ki", "ok", "ri", "tik"],
        "suffixes": ["bit", "ik", "ix", "nak", "nok", "rik", "snik", "tik", "yip", "zix"],
    },
    "leonin": {
        "prefixes": ["Ajan", "Brim", "Kha", "Leon", "Mau", "Neme", "Raka", "Sava", "Taj", "Zar"],
        "middles": ["", "a", "an", "ar", "ia", "ka", "ra", "ri", "ta", "zar"],
        "suffixes": ["ar", "dan", "ka", "mir", "ra", "ran", "sar", "tan", "zar", "zor"],
    },
    "lizardfolk": {
        "prefixes": ["Ak", "Chak", "Hiss", "Iss", "Kess", "Sarr", "Sesh", "Ssik", "Tak", "Vess"],
        "middles": ["", "a", "ak", "esh", "ik", "iss", "ka", "ss", "tak", "zz"],
        "suffixes": ["ak", "esh", "hiss", "ik", "iss", "kess", "sarr", "ssik", "tak", "vess"],
    },
    "loxodon": {
        "prefixes": ["Bala", "Doma", "Gajan", "Hathi", "Kava", "Luma", "Mora", "Nala", "Rava", "Soma"],
        "middles": ["", "a", "an", "ar", "esh", "i", "ma", "ra", "thi", "va"],
        "suffixes": ["an", "das", "esh", "han", "ma", "ra", "thi", "var", "vra", "yan"],
    },
    "minotauro": {
        "prefixes": ["Aster", "Boro", "Dhor", "Ghor", "Karn", "Mog", "Rauk", "Taur", "Vorn", "Zarn"],
        "middles": ["", "a", "ak", "ar", "gor", "on", "or", "ra", "taur", "uk"],
        "suffixes": ["ak", "gor", "horn", "kar", "on", "or", "rak", "taur", "vorn", "zarn"],
    },
    "satiro": {
        "prefixes": ["Aul", "Bacch", "Daph", "Euph", "Faun", "Lyr", "Mel", "Nys", "Pan", "Thyr"],
        "middles": ["", "a", "ae", "ia", "ion", "os", "ra", "ri", "th", "ys"],
        "suffixes": ["as", "ion", "os", "ra", "ros", "thos", "wyn", "dros", "lios", "nyx"],
    },
    "shifter": {
        "prefixes": ["Ash", "Briar", "Fang", "Gray", "Keen", "Moon", "Riven", "Sable", "Thorn", "Wolf"],
        "middles": ["", "a", "claw", "en", "fang", "ra", "ren", "run", "shade", "wild"],
        "suffixes": ["claw", "fang", "mane", "pelt", "run", "shade", "snap", "thorn", "wild", "wyn"],
    },
    "tabaxi": {
        "prefixes": ["Brillo", "Canta", "Danza", "Garra", "Luna", "Mancha", "Nube", "Rayo", "Sombra", "Viento"],
        "middles": ["", "de", "del", "la", "las", "los", "sobre", "tras", "en", "bajo"],
        "suffixes": ["Aurora", "Cobre", "Hierba", "Lluvia", "Marea", "Noche", "Oro", "Plata", "Sol", "Trueno"],
    },
    "tortle": {
        "prefixes": ["Baku", "Domo", "Gamu", "Kapa", "Moku", "Nalu", "Pahu", "Rongo", "Taku", "Yomo"],
        "middles": ["", "a", "ka", "ko", "lu", "mo", "na", "pa", "ro", "tu"],
        "suffixes": ["ka", "lu", "mo", "na", "pa", "ro", "shell", "tu", "wa", "yo"],
    },
    "triton": {
        "prefixes": ["Alo", "Coral", "Darya", "Maren", "Nere", "Orin", "Pel", "Thal", "Tide", "Var"],
        "middles": ["", "a", "ae", "ia", "ion", "mar", "ra", "thal", "ti", "us"],
        "suffixes": ["mar", "mir", "os", "ra", "thal", "tide", "us", "var", "wyn", "ion"],
    },
    "warforged": {
        "prefixes": ["Anvil", "Bastion", "Bolt", "Cipher", "Forge", "Gear", "Iron", "Pillar", "Rune", "Vector"],
        "middles": ["", "a", "core", "gear", "line", "mark", "plate", "spark", "unit", "ward"],
        "suffixes": ["Core", "Gear", "Guard", "Line", "Mark", "Plate", "Spark", "Unit", "Ward", "Zero"],
    },
    "yuan_ti": {
        "prefixes": ["As", "Ess", "Hss", "Iss", "Ssa", "Sseth", "Ssil", "Vess", "Xis", "Yss"],
        "middles": ["", "a", "esh", "iss", "ka", "ra", "s", "ss", "thi", "za"],
        "suffixes": ["esh", "iss", "ka", "ra", "sith", "ssar", "thi", "vess", "xis", "za"],
    },
})

FANTASY_RACE_LABELS = (
    ("aarakocra", "Aarakocra"),
    ("aasimar", "Aasimar"),
    ("bugbear", "Bugbear"),
    ("centauro", "Centauro"),
    ("changeling", "Changeling"),
    ("dragonborn", "Dragonborn"),
    ("enano", "Enano"),
    ("elfo", "Elfo"),
    ("hada", "Hada / fairy"),
    ("firbolg", "Firbolg"),
    ("genasi", "Genasi"),
    ("giff", "Giff"),
    ("gith", "Gith"),
    ("gnomo", "Gnomo"),
    ("goblin", "Goblin"),
    ("goliat", "Goliat"),
    ("harengon", "Harengon"),
    ("hobgoblin", "Hobgoblin"),
    ("humano", "Humano fantastico"),
    ("kenku", "Kenku"),
    ("kobold", "Kobold"),
    ("leonin", "Leonin"),
    ("lizardfolk", "Lizardfolk"),
    ("loxodon", "Loxodon"),
    ("mediano", "Mediano / halfling"),
    ("medio_elfo", "Medio elfo"),
    ("medio_orco", "Medio orco"),
    ("minotauro", "Minotauro"),
    ("orco", "Orco"),
    ("satiro", "Satiro"),
    ("shifter", "Shifter"),
    ("tabaxi", "Tabaxi"),
    ("tiefling", "Tiefling"),
    ("tortle", "Tortle"),
    ("triton", "Triton"),
    ("warforged", "Warforged"),
    ("yuan_ti", "Yuan-ti"),
)

CITY_ROOTS = [
    "Ald", "Bruma", "Cal", "Dorna", "Eld", "Faro", "Gris", "Luna",
    "Niebla", "Roca", "Val", "Tor", "Mir", "Sol", "Umbria",
]

CITY_SUFFIXES = [
    "haven", "dor", "burgo", "marca", "val", "torre", "puerto",
    "senda", "mora", "guardia", "ria", "mont",
]

CITY_TITLES = [
    "Puerto de", "Torre de", "Villa", "Bastion de", "Fortaleza de",
    "Puerta de", "Valle de", "Guardia de",
]

CITY_THEMES = [
    "Luna", "Niebla", "Ceniza", "Cristal", "Sal", "Hierro", "Marea",
    "Aurora", "Umbria", "Eld", "Bruma", "Roca",
]

CATEGORY_ALIASES = {
    "persona": "persona",
    "personas": "persona",
    "humano real": "persona",
    "real": "persona",
    "fantasia": "fantasia",
    "fantasia personaje": "fantasia",
    "fantasy": "fantasia",
    "ciudad": "ciudad",
    "ciudades": "ciudad",
    "ciudad fantastica": "ciudad",
    "ciudades fantasticas": "ciudad",
}

ORIGIN_ALIASES = {
    "espana": "es",
    "españa": "es",
    "espanol": "es",
    "español": "es",
    "espanola": "es",
    "española": "es",
    "mexico": "mx",
    "mexicano": "mx",
    "mexicana": "mx",
    "francia": "fr",
    "frances": "fr",
    "francesa": "fr",
    "inglaterra": "gb",
    "ingles": "gb",
    "inglesa": "gb",
    "reino unido": "gb",
    "japon": "jp",
    "japones": "jp",
    "japonesa": "jp",
}

RACE_ALIASES = {
    "humanos": "humano",
    "humana": "humano",
    "humanas": "humano",
    "human": "humano",
    "humans": "humano",
    "elfos": "elfo",
    "elfa": "elfo",
    "elfas": "elfo",
    "orcos": "orco",
    "orca": "orco",
    "orcas": "orco",
    "orc": "orco",
    "orcs": "orco",
    "enanos": "enano",
    "enana": "enano",
    "enanas": "enano",
    "dwarf": "enano",
    "dwarves": "enano",
    "dwarfs": "enano",
    "elf": "elfo",
    "elves": "elfo",
    "dragonido": "dragonborn",
    "dragonidos": "dragonborn",
    "draconido": "dragonborn",
    "draconidos": "dragonborn",
    "draconico": "dragonborn",
    "draconicos": "dragonborn",
    "gnomos": "gnomo",
    "gnome": "gnomo",
    "gnomes": "gnomo",
    "goliath": "goliat",
    "goliaths": "goliat",
    "goliats": "goliat",
    "halfling": "mediano",
    "halflings": "mediano",
    "medianos": "mediano",
    "medio elfo": "medio_elfo",
    "medio-elfo": "medio_elfo",
    "media elfa": "medio_elfo",
    "half elf": "medio_elfo",
    "half-elf": "medio_elfo",
    "half elves": "medio_elfo",
    "half-elves": "medio_elfo",
    "medio orco": "medio_orco",
    "medio-orco": "medio_orco",
    "media orca": "medio_orco",
    "half orc": "medio_orco",
    "half-orc": "medio_orco",
    "half orcs": "medio_orco",
    "half-orcs": "medio_orco",
    "tieflings": "tiefling",
    "centaur": "centauro",
    "centaurs": "centauro",
    "centauros": "centauro",
    "fairy": "hada",
    "fairies": "hada",
    "hadas": "hada",
    "minotaur": "minotauro",
    "minotaurs": "minotauro",
    "minotauros": "minotauro",
    "satyr": "satiro",
    "satyrs": "satiro",
    "satiros": "satiro",
    "yuan ti": "yuan_ti",
    "yuan-ti": "yuan_ti",
    "yuan ti pureblood": "yuan_ti",
    "yuan-ti pureblood": "yuan_ti",
    "hombre lagarto": "lizardfolk",
    "hombres lagarto": "lizardfolk",
    "lagarto": "lizardfolk",
    "goblins": "goblin",
    "kobolds": "kobold",
    "ciudades": "ciudad",
    "ciudad fantastica": "ciudad",
}


def generate_names(category="persona", subtype="es", gender="any", seed=None):
    rng = random.Random(seed)
    category = normalize_category(category)

    if category == "persona":
        names = generate_human_names(normalize_origin(subtype), normalize_gender(gender), rng)
    elif category == "ciudad":
        names = generate_city_names(rng)
    else:
        names = generate_pattern_names(normalize_race(subtype), normalize_gender(gender), rng)

    return names[:RESULT_COUNT]


def generate_human_names(origin, gender, rng):
    data = HUMAN_NAME_SETS.get(origin, HUMAN_NAME_SETS["es"])
    names = []
    seen = set()
    genders = ("female", "male") if gender == "any" else (gender,)

    while len(names) < RESULT_COUNT:
        selected_gender = rng.choice(genders)
        first = rng.choice(data[selected_gender])
        surname_count = 2 if origin in ("es", "mx") and rng.random() < 0.72 else 1
        surnames = rng.sample(data["surnames"], surname_count)
        name = " ".join([first, *surnames])

        if name not in seen:
            names.append(name)
            seen.add(name)

    return names


def generate_city_names(rng):
    names = []
    seen = set()

    while len(names) < RESULT_COUNT:
        if rng.random() < 0.55:
            name = f"{rng.choice(CITY_ROOTS)}{rng.choice(CITY_SUFFIXES)}"
        else:
            name = f"{rng.choice(CITY_TITLES)} {rng.choice(CITY_THEMES)}"

        if name not in seen:
            names.append(name)
            seen.add(name)

    return names


def generate_pattern_names(kind, gender, rng):
    data = FANTASY_RACES.get(kind, FANTASY_RACES["humano"])
    names = []
    seen = set()

    while len(names) < RESULT_COUNT:
        suffixes = data.get(f"{gender}_suffixes", data["suffixes"])
        parts = [
            rng.choice(data["prefixes"]),
            rng.choice(data["middles"]),
            rng.choice(suffixes),
        ]
        name = clean_generated_name("".join(parts))

        if name not in seen:
            names.append(name)
            seen.add(name)

    return names


def normalize_category(value):
    normalized = normalize_text(value)
    return CATEGORY_ALIASES.get(normalized, normalized if normalized in ("persona", "fantasia", "ciudad") else "persona")


def normalize_origin(value):
    normalized = normalize_text(value)
    return ORIGIN_ALIASES.get(normalized, normalized if normalized in HUMAN_NAME_SETS else "es")


def normalize_race(value):
    normalized = normalize_text(value)
    return RACE_ALIASES.get(normalized, normalized if normalized in FANTASY_RACES else "humano")


def normalize_gender(value):
    normalized = normalize_text(value)

    if normalized in ("female", "femenino", "mujer", "f"):
        return "female"
    if normalized in ("male", "masculino", "hombre", "m"):
        return "male"

    return "any"


def clean_generated_name(value):
    value = value.replace("dedel", "del").replace("dela", "de la")
    value = value.replace("dede", "de").replace("lala", "la")
    return value[:1].upper() + value[1:]


def normalize_text(value):
    text = str(value or "").strip().lower()
    text = "".join(
        char
        for char in unicodedata.normalize("NFD", text)
        if unicodedata.category(char) != "Mn"
    )
    return " ".join(text.split())
