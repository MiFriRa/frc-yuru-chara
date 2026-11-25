#!/usr/bin/env python3
"""
Yuru-Dex Offline ETL Pipeline
Generates:
  - public/data/japan_prefectures.geojson  (47 prefectures, simplified < 180 KB)
  - public/data/prefecture_adjacency.json  (47-node graph with land borders + island bridges)
  - public/data/mascots.json               (~600 real Japanese mascots with structured DNA)

Data sources:
  1. Japan prefecture boundaries: dataofjapan/land (japan.geojson)
  2. Japanese mascot records: tacookson/data (japanese-mascots/yuru-gp.txt)
  3. Verified historical debut registry for iconic real yuru-chara
"""

from __future__ import annotations

import csv
import io
import json
import math
import os
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "data"
CACHE_DIR = Path(os.environ.get("YURU_CACHE_DIR", str(ROOT / ".cache_etl")))

GEOJSON_URL = "https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson"
YURUGP_URL = "https://raw.githubusercontent.com/tacookson/data/master/japanese-mascots/yuru-gp.txt"

# Canonical 47 Japanese prefectures keyed by 2-digit JIS code ("01".."47")
PREFECTURES: dict[str, dict[str, str]] = {
    "01": {"name_en": "Hokkaido", "name_jp": "北海道", "region_en": "Hokkaido"},
    "02": {"name_en": "Aomori", "name_jp": "青森県", "region_en": "Tohoku"},
    "03": {"name_en": "Iwate", "name_jp": "岩手県", "region_en": "Tohoku"},
    "04": {"name_en": "Miyagi", "name_jp": "宮城県", "region_en": "Tohoku"},
    "05": {"name_en": "Akita", "name_jp": "秋田県", "region_en": "Tohoku"},
    "06": {"name_en": "Yamagata", "name_jp": "山形県", "region_en": "Tohoku"},
    "07": {"name_en": "Fukushima", "name_jp": "福島県", "region_en": "Tohoku"},
    "08": {"name_en": "Ibaraki", "name_jp": "茨城県", "region_en": "Kanto"},
    "09": {"name_en": "Tochigi", "name_jp": "栃木県", "region_en": "Kanto"},
    "10": {"name_en": "Gunma", "name_jp": "群馬県", "region_en": "Kanto"},
    "11": {"name_en": "Saitama", "name_jp": "埼玉県", "region_en": "Kanto"},
    "12": {"name_en": "Chiba", "name_jp": "千葉県", "region_en": "Kanto"},
    "13": {"name_en": "Tokyo", "name_jp": "東京都", "region_en": "Kanto"},
    "14": {"name_en": "Kanagawa", "name_jp": "神奈川県", "region_en": "Kanto"},
    "15": {"name_en": "Niigata", "name_jp": "新潟県", "region_en": "Chubu"},
    "16": {"name_en": "Toyama", "name_jp": "富山県", "region_en": "Chubu"},
    "17": {"name_en": "Ishikawa", "name_jp": "石川県", "region_en": "Chubu"},
    "18": {"name_en": "Fukui", "name_jp": "福井県", "region_en": "Chubu"},
    "19": {"name_en": "Yamanashi", "name_jp": "山梨県", "region_en": "Chubu"},
    "20": {"name_en": "Nagano", "name_jp": "長野県", "region_en": "Chubu"},
    "21": {"name_en": "Gifu", "name_jp": "岐阜県", "region_en": "Chubu"},
    "22": {"name_en": "Shizuoka", "name_jp": "静岡県", "region_en": "Chubu"},
    "23": {"name_en": "Aichi", "name_jp": "愛知県", "region_en": "Chubu"},
    "24": {"name_en": "Mie", "name_jp": "三重県", "region_en": "Kansai"},
    "25": {"name_en": "Shiga", "name_jp": "滋賀県", "region_en": "Kansai"},
    "26": {"name_en": "Kyoto", "name_jp": "京都府", "region_en": "Kansai"},
    "27": {"name_en": "Osaka", "name_jp": "大阪府", "region_en": "Kansai"},
    "28": {"name_en": "Hyogo", "name_jp": "兵庫県", "region_en": "Kansai"},
    "29": {"name_en": "Nara", "name_jp": "奈良県", "region_en": "Kansai"},
    "30": {"name_en": "Wakayama", "name_jp": "和歌山県", "region_en": "Kansai"},
    "31": {"name_en": "Tottori", "name_jp": "鳥取県", "region_en": "Chugoku"},
    "32": {"name_en": "Shimane", "name_jp": "島根県", "region_en": "Chugoku"},
    "33": {"name_en": "Okayama", "name_jp": "岡山県", "region_en": "Chugoku"},
    "34": {"name_en": "Hiroshima", "name_jp": "広島県", "region_en": "Chugoku"},
    "35": {"name_en": "Yamaguchi", "name_jp": "山口県", "region_en": "Chugoku"},
    "36": {"name_en": "Tokushima", "name_jp": "徳島県", "region_en": "Shikoku"},
    "37": {"name_en": "Kagawa", "name_jp": "香川県", "region_en": "Shikoku"},
    "38": {"name_en": "Ehime", "name_jp": "愛媛県", "region_en": "Shikoku"},
    "39": {"name_en": "Kochi", "name_jp": "高知県", "region_en": "Shikoku"},
    "40": {"name_en": "Fukuoka", "name_jp": "福岡県", "region_en": "Kyushu"},
    "41": {"name_en": "Saga", "name_jp": "佐賀県", "region_en": "Kyushu"},
    "42": {"name_en": "Nagasaki", "name_jp": "長崎県", "region_en": "Kyushu"},
    "43": {"name_en": "Kumamoto", "name_jp": "熊本県", "region_en": "Kyushu"},
    "44": {"name_en": "Oita", "name_jp": "大分県", "region_en": "Kyushu"},
    "45": {"name_en": "Miyazaki", "name_jp": "宮崎県", "region_en": "Kyushu"},
    "46": {"name_en": "Kagoshima", "name_jp": "鹿児島県", "region_en": "Kyushu"},
    "47": {"name_en": "Okinawa", "name_jp": "沖縄県", "region_en": "Kyushu"},
}

NAME_TO_JIS: dict[str, str] = {v["name_en"].lower(): k for k, v in PREFECTURES.items()}

# Accurate land borders + major fixed bridges/tunnels/ferries connecting islands:
# 01<->02 Seikan Tunnel, 12<->14 Tokyo Bay Aqua-Line, 28<->36 Akashi/Naruto,
# 33<->37 Seto Ohashi, 34<->38 Shimanami Kaido, 35<->40 Kanmon, 46<->47 Kagoshima-Okinawa ferry
ADJACENCY_EDGES: list[tuple[str, str]] = [
    ("01", "02"),  # Seikan Tunnel
    ("02", "03"), ("02", "05"),
    ("03", "04"), ("03", "05"),
    ("04", "05"), ("04", "06"), ("04", "07"),
    ("05", "06"),
    ("06", "07"), ("06", "15"),
    ("07", "08"), ("07", "09"), ("07", "10"), ("07", "15"),
    ("08", "09"), ("08", "11"), ("08", "12"),
    ("09", "10"), ("09", "11"),
    ("10", "11"), ("10", "15"), ("10", "20"),
    ("11", "12"), ("11", "13"), ("11", "19"), ("11", "20"),
    ("12", "13"), ("12", "14"),  # 12<->14 Aqua-Line
    ("13", "14"), ("13", "19"),
    ("14", "19"), ("14", "22"),
    ("15", "16"), ("15", "20"),
    ("16", "17"), ("16", "20"), ("16", "21"),
    ("17", "18"), ("17", "21"),
    ("18", "21"), ("18", "25"), ("18", "26"),
    ("19", "20"), ("19", "22"),
    ("20", "21"), ("20", "22"), ("20", "23"),
    ("21", "23"), ("21", "24"), ("21", "25"),
    ("22", "23"),
    ("23", "24"),
    ("24", "25"), ("24", "26"), ("24", "29"), ("24", "30"),
    ("25", "26"),
    ("26", "27"), ("26", "28"), ("26", "29"),
    ("27", "28"), ("27", "29"), ("27", "30"),
    ("28", "31"), ("28", "33"), ("28", "36"),  # 28<->36 Akashi/Naruto
    ("29", "30"),
    ("31", "32"), ("31", "33"), ("31", "34"),
    ("32", "34"), ("32", "35"),
    ("33", "34"), ("33", "37"),  # 33<->37 Seto Ohashi
    ("34", "35"), ("34", "38"),  # 34<->38 Shimanami Kaido
    ("35", "40"),  # 35<->40 Kanmon
    ("36", "37"), ("36", "38"), ("36", "39"),
    ("37", "38"),
    ("38", "39"),
    ("40", "41"), ("40", "43"), ("40", "44"),
    ("41", "42"),
    ("43", "44"), ("43", "45"), ("43", "46"),
    ("44", "45"),
    ("45", "46"),
    ("46", "47"),  # 46<->47 Kagoshima-Okinawa ferry
]

# 32-trait vocabulary -> (domain, trait_family, default_primary_hex, default_accent_hex)
TRAIT_META: dict[str, tuple[str, str, str, str]] = {
    # Fauna - mammal
    "bear":    ("Fauna", "mammal", "#374151", "#EF4444"),
    "cat":     ("Fauna", "mammal", "#F59E0B", "#FEF3C7"),
    "dog":     ("Fauna", "mammal", "#D97706", "#FDE68A"),
    "rabbit":  ("Fauna", "mammal", "#F472B6", "#FDF2F8"),
    "raccoon": ("Fauna", "mammal", "#92400E", "#FCD34D"),
    "fox":     ("Fauna", "mammal", "#EA580C", "#FEF3C7"),
    "deer":    ("Fauna", "mammal", "#B45309", "#FDE68A"),
    "cow":     ("Fauna", "mammal", "#1F2937", "#F9FAFB"),
    "horse":   ("Fauna", "mammal", "#A16207", "#FEF08A"),
    # Fauna - avian
    "bird":    ("Fauna", "avian", "#0EA5E9", "#FACC15"),
    # Fauna - aquatic
    "fish":    ("Fauna", "aquatic", "#2563EB", "#38BDF8"),
    "frog":    ("Fauna", "aquatic", "#16A34A", "#BEF264"),
    "turtle":  ("Fauna", "aquatic", "#15803D", "#FDE047"),
    # Flora_Food - fruit
    "citrus":  ("Flora_Food", "fruit", "#F97316", "#FACC15"),
    "apple":   ("Flora_Food", "fruit", "#DC2626", "#4ADE80"),
    "peach":   ("Flora_Food", "fruit", "#FB7185", "#BBF7D0"),
    "melon":   ("Flora_Food", "fruit", "#22C55E", "#FDE047"),
    # Flora_Food - crop_dish
    "rice":    ("Flora_Food", "crop_dish", "#EAB308", "#1F2937"),
    "noodle":  ("Flora_Food", "crop_dish", "#D97706", "#EF4444"),
    # Flora_Food - botanical
    "flower":  ("Flora_Food", "botanical", "#EC4899", "#FDE047"),
    "tree":    ("Flora_Food", "botanical", "#15803D", "#86EFAC"),
    # Lore_History - warrior
    "samurai": ("Lore_History", "warrior", "#B91C1C", "#F59E0B"),
    "ninja":   ("Lore_History", "warrior", "#312E81", "#EF4444"),
    # Lore_History - yokai_myth
    "dragon":  ("Lore_History", "yokai_myth", "#059669", "#F59E0B"),
    "kappa":   ("Lore_History", "yokai_myth", "#16A34A", "#FACC15"),
    "oni":     ("Lore_History", "yokai_myth", "#DC2626", "#FACC15"),
    "fairy":   ("Lore_History", "yokai_myth", "#8B5CF6", "#F9A8D4"),
    # Geo_Nature - landform
    "mountain": ("Geo_Nature", "landform", "#1D4ED8", "#93C5FD"),
    "water":    ("Geo_Nature", "landform", "#0284C7", "#67E8F9"),
    # Object_Abstract - heritage_object
    "castle":  ("Object_Abstract", "heritage_object", "#475569", "#F59E0B"),
    "star":    ("Object_Abstract", "heritage_object", "#4F46E5", "#FACC15"),
    "ceramic": ("Object_Abstract", "heritage_object", "#B45309", "#38BDF8"),
}

# Verified historical debut registry for real iconic Japanese mascots.
# Records with "gp_id" enrich the matching record in yuru-gp.txt;
# Records with gp_id=None are iconic prefectural/public mascots that did not enter GP voting.
VERIFIED_ICONIC_MASCOTS: list[dict[str, Any]] = [
    # --- Enriched from yuru-gp.txt (matched by character_id) ---
    {
        "gp_id": "1", "id": "kumamon-43", "name_en": "Kumamon", "name_jp": "くまモン",
        "jis_code": "43", "municipality_en": "Kumamoto", "year": 2010,
        "primary_trait": "bear", "secondary_traits": [],
        "primary_color": "#1F2937", "accent_color": "#E3350D",
        "bio_en": "Official black bear PR mascot of Kumamoto Prefecture, created for the Kyushu Shinkansen launch.",
    },
    {
        "gp_id": "2", "id": "barysan-38", "name_en": "Barysan", "name_jp": "バリィさん",
        "jis_code": "38", "municipality_en": "Imabari", "year": 2009,
        "primary_trait": "bird", "secondary_traits": ["water"],
        "primary_color": "#FACC15", "accent_color": "#0284C7",
        "bio_en": "Round yellow chick mascot of Imabari wearing a Kurushima Bridge crown and carrying a boat wallet.",
    },
    {
        "gp_id": "3", "id": "nishiko-kun-13", "name_en": "Nishiko-kun", "name_jp": "にしこくん",
        "jis_code": "13", "municipality_en": "Kokubunji", "year": 2010,
        "primary_trait": "fairy", "secondary_traits": ["ceramic"],
        "primary_color": "#94A3B8", "accent_color": "#F97316",
        "bio_en": "Long-legged round roof-tile fairy inspired by ancient Abumi tiles excavated in Kokubunji, Tokyo.",
    },
    {
        "gp_id": "6", "id": "fukka-chan-11", "name_en": "Fukka-chan", "name_jp": "ふっかちゃん",
        "jis_code": "11", "municipality_en": "Fukaya", "year": 2010,
        "primary_trait": "rabbit", "secondary_traits": ["flower"],
        "primary_color": "#16A34A", "accent_color": "#EC4899",
        "bio_en": "Fukaya City mascot combining a rabbit-deer creature with iconic Fukaya green onion horns and tulip button.",
    },
    {
        "gp_id": "7", "id": "momomaru-40", "name_en": "Momomaru", "name_jp": "モモマルくん",
        "jis_code": "40", "municipality_en": "Kitakyushu", "year": 2007,
        "primary_trait": "raccoon", "secondary_traits": ["peach"],
        "primary_color": "#FB7185", "accent_color": "#FDE68A",
        "bio_en": "Flying squirrel mascot of Kitakyushu promoting kindness and human rights across Fukuoka.",
    },
    {
        "gp_id": "9", "id": "takinomichi-yuzuru-27", "name_en": "Takinomichi Yuzuru", "name_jp": "滝ノ道ゆずる",
        "jis_code": "27", "municipality_en": "Minoh", "year": 2009,
        "primary_trait": "citrus", "secondary_traits": ["samurai"],
        "primary_color": "#FACC15", "accent_color": "#DC2626",
        "bio_en": "Yuzu citrus samurai mascot of Minoh City in Osaka, sporting a topknot and autumn maple sash.",
    },
    {
        "gp_id": "18", "id": "gunma-chan-10", "name_en": "Gunma-chan", "name_jp": "ぐんまちゃん",
        "jis_code": "10", "municipality_en": "Maebashi", "year": 1994,
        "primary_trait": "horse", "secondary_traits": [],
        "primary_color": "#D97706", "accent_color": "#22C55E",
        "bio_en": "Pony mascot of Gunma Prefecture wearing a green cap; debuted in 1994 and won the 2014 Grand Prix.",
    },
    {
        "gp_id": "20", "id": "sanomaru-09", "name_en": "Sanomaru", "name_jp": "さのまる",
        "jis_code": "09", "municipality_en": "Sano", "year": 2011,
        "primary_trait": "dog", "secondary_traits": ["noodle", "samurai"],
        "primary_color": "#DC2626", "accent_color": "#FACC15",
        "bio_en": "Samurai dog of Sano castle town wearing a Sano Ramen bowl hat with crispy fried-potato swords.",
    },
    {
        "gp_id": "21", "id": "shimanekko-32", "name_en": "Shimanekko", "name_jp": "しまねっこ",
        "jis_code": "32", "municipality_en": "Matsue", "year": 2010,
        "primary_trait": "cat", "secondary_traits": ["castle"],
        "primary_color": "#FACC15", "accent_color": "#DC2626",
        "bio_en": "Golden cat tourism ambassador of Shimane Prefecture wearing an Izumo Taisha shrine roof hat.",
    },
    {
        "gp_id": "31", "id": "unari-kun-12", "name_en": "Unari-kun", "name_jp": "うなりくん",
        "jis_code": "12", "municipality_en": "Narita", "year": 2009,
        "primary_trait": "fish", "secondary_traits": ["star"],
        "primary_color": "#0EA5E9", "accent_color": "#FACC15",
        "bio_en": "Narita City ambassador blending local grilled eel with a Narita Airport jet plane from Planet Unari.",
    },
    {
        "gp_id": "37", "id": "shusse-daimyo-ieyasu-kun-22", "name_en": "Shusse Daimyo Ieyasu-kun", "name_jp": "出世大名家康くん",
        "jis_code": "22", "municipality_en": "Hamamatsu", "year": 2011,
        "primary_trait": "samurai", "secondary_traits": ["fish", "citrus"],
        "primary_color": "#1E3A8A", "accent_color": "#F59E0B",
        "bio_en": "Hamamatsu warlord mascot modeled on Tokugawa Ieyasu with an eel topknot, piano robe, and mikan crest.",
    },
    {
        "gp_id": "47", "id": "musubimaru-04", "name_en": "Musubimaru", "name_jp": "むすび丸",
        "jis_code": "04", "municipality_en": "Sendai", "year": 2007,
        "primary_trait": "rice", "secondary_traits": ["samurai"],
        "primary_color": "#1F2937", "accent_color": "#FACC15",
        "bio_en": "Miyagi tourism chief shaped like an onigiri rice ball wearing Date Masamune's crescent-moon helmet.",
    },
    {
        "gp_id": "93", "id": "hanipon-11", "name_en": "Hanipon", "name_jp": "はにぽん",
        "jis_code": "11", "municipality_en": "Honjo", "year": 2010,
        "primary_trait": "ceramic", "secondary_traits": [],
        "primary_color": "#D97706", "accent_color": "#FDE68A",
        "bio_en": "Smiling terracotta haniwa figurine mascot of Honjo City, modeled on a 1,400-year-old artifact.",
    },
    {
        "gp_id": "146", "id": "melonkuma-01", "name_en": "Melonkuma", "name_jp": "メロン熊",
        "jis_code": "01", "municipality_en": "Yubari", "year": 2009,
        "primary_trait": "bear", "secondary_traits": ["melon"],
        "primary_color": "#16A34A", "accent_color": "#F97316",
        "bio_en": "Fierce brown bear of Yubari, Hokkaido that mutated after eating too many sweet Yubari King melons.",
    },
    {
        "gp_id": "159", "id": "toripy-31", "name_en": "Toripy", "name_jp": "トリピー",
        "jis_code": "31", "municipality_en": "Tottori", "year": 1997,
        "primary_trait": "bird", "secondary_traits": ["peach"],
        "primary_color": "#84CC16", "accent_color": "#EF4444",
        "bio_en": "Long-running official bird mascot of Tottori Prefecture inspired by 20th Century pears and coastal wings.",
    },
    {
        "gp_id": "350", "id": "choruru-35", "name_en": "Choruru", "name_jp": "ちょるる",
        "jis_code": "35", "municipality_en": "Yamaguchi", "year": 2009,
        "primary_trait": "mountain", "secondary_traits": ["fairy"],
        "primary_color": "#16A34A", "accent_color": "#EF4444",
        "bio_en": "Official PR manager of Yamaguchi Prefecture whose spiky green hair forms the kanji character for mountain.",
    },
    {
        "gp_id": "357", "id": "alucuma-20", "name_en": "Alucuma", "name_jp": "アルクマ",
        "jis_code": "20", "municipality_en": "Nagano", "year": 2009,
        "primary_trait": "bear", "secondary_traits": ["apple"],
        "primary_color": "#15803D", "accent_color": "#DC2626",
        "bio_en": "Wanderlust bear mascot of Nagano Prefecture who wears a bright Shinshu apple hood to stay warm.",
    },
    {
        "gp_id": "358", "id": "hoya-boya-04", "name_en": "Hoya Boya", "name_jp": "ホヤぼーや",
        "jis_code": "04", "municipality_en": "Kesennuma", "year": 2008,
        "primary_trait": "fish", "secondary_traits": ["samurai"],
        "primary_color": "#EA580C", "accent_color": "#0EA5E9",
        "bio_en": "Kesennuma sea-pineapple prince wielding a Pacific saury sword and scallop belt.",
    },
    {
        "gp_id": "364", "id": "kaparu-11", "name_en": "Kaparu", "name_jp": "カパル",
        "jis_code": "11", "municipality_en": "Shiki", "year": 2000,
        "primary_trait": "kappa", "secondary_traits": [],
        "primary_color": "#22C55E", "accent_color": "#FACC15",
        "bio_en": "Cucumber-loving bass-playing kappa mascot of Shiki City, Saitama; winner of the 2018 Grand Prix.",
    },
    {
        "gp_id": "390", "id": "konyu-kun-24", "name_en": "Konyu-kun", "name_jp": "こにゅうどうくん",
        "jis_code": "24", "municipality_en": "Yokkaichi", "year": 1997,
        "primary_trait": "oni", "secondary_traits": [],
        "primary_color": "#DC2626", "accent_color": "#1E3A8A",
        "bio_en": "Mischievous yokai boy mascot of Yokkaichi, Mie whose extendable tongue grants wishes.",
    },
    {
        "gp_id": "438", "id": "udon-nou-37", "name_en": "Udon-nou", "name_jp": "うどん脳",
        "jis_code": "37", "municipality_en": "Takamatsu", "year": 2011,
        "primary_trait": "noodle", "secondary_traits": ["oni"],
        "primary_color": "#F59E0B", "accent_color": "#DC2626",
        "bio_en": "Quirky Kagawa yokai whose head turned into a steaming bowl of Sanuki udon from eating too many noodles.",
    },
    {
        "gp_id": "487", "id": "kuroshio-kun-39", "name_en": "Kuroshio-kun", "name_jp": "くろしおくん",
        "jis_code": "39", "municipality_en": "Kochi", "year": 1999,
        "primary_trait": "water", "secondary_traits": [],
        "primary_color": "#0284C7", "accent_color": "#FACC15",
        "bio_en": "Official ocean-wave mascot of Kochi Prefecture named after the warm Pacific Kuroshio Current.",
    },
    {
        "gp_id": "671", "id": "funassyi-12", "name_en": "Funassyi", "name_jp": "ふなっしー",
        "jis_code": "12", "municipality_en": "Funabashi", "year": 2011,
        "primary_trait": "fairy", "secondary_traits": ["apple"],
        "primary_color": "#FACC15", "accent_color": "#0EA5E9",
        "bio_en": "Hyperactive unofficial pear fairy of Funabashi, Chiba famous for explosive jumps and viral energy.",
    },
    {
        "gp_id": "768", "id": "sugitchi-05", "name_en": "Sugitchi", "name_jp": "スギッチ",
        "jis_code": "05", "municipality_en": "Akita", "year": 2004,
        "primary_trait": "tree", "secondary_traits": [],
        "primary_color": "#15803D", "accent_color": "#FACC15",
        "bio_en": "Akita cedar tree mascot created for the 2007 Akita Wakasugi National Sports Festival.",
    },
    {
        "gp_id": "940", "id": "mikyan-38", "name_en": "Mikyan", "name_jp": "みきゃん",
        "jis_code": "38", "municipality_en": "Matsuyama", "year": 2011,
        "primary_trait": "dog", "secondary_traits": ["citrus"],
        "primary_color": "#F97316", "accent_color": "#22C55E",
        "bio_en": "Official Ehime Prefecture puppy mascot sporting bright mandarin orange fur, leaf ears, and a blossom tail.",
    },
    {
        "gp_id": "957", "id": "shinjo-kun-39", "name_en": "Shinjo-kun", "name_jp": "しんじょう君",
        "jis_code": "39", "municipality_en": "Susaki", "year": 2013,
        "primary_trait": "raccoon", "secondary_traits": ["noodle"],
        "primary_color": "#B45309", "accent_color": "#EF4444",
        "bio_en": "Japanese river otter mascot of Susaki, Kochi wearing a clay-pot nabeyaki ramen hat; 2016 Grand Prix winner.",
    },
    {
        "gp_id": "969", "id": "ponta-13", "name_en": "Ponta", "name_jp": "ポンタ",
        "jis_code": "13", "municipality_en": "Tokyo", "year": 2010,
        "primary_trait": "raccoon", "secondary_traits": [],
        "primary_color": "#D97706", "accent_color": "#EF4444",
        "bio_en": "Cheerful Tokyo tanuki raccoon-dog mascot representing the nationwide Ponta loyalty network.",
    },
    {
        "gp_id": "1029", "id": "inunakin-27", "name_en": "Inunakin", "name_jp": "イヌナキン",
        "jis_code": "27", "municipality_en": "Izumisano", "year": 2013,
        "primary_trait": "dog", "secondary_traits": ["samurai"],
        "primary_color": "#DC2626", "accent_color": "#FDE047",
        "bio_en": "Heroic mountain-trained warrior dog mascot of Izumisano, Osaka inspired by Mount Inunaki folklore.",
    },
    {
        "gp_id": "1312", "id": "yukimaru-29", "name_en": "Yukimaru", "name_jp": "雪丸",
        "jis_code": "29", "municipality_en": "Oji", "year": 2013,
        "primary_trait": "dog", "secondary_traits": ["fairy"],
        "primary_color": "#60A5FA", "accent_color": "#FACC15",
        "bio_en": "White dog mascot of Oji Town, Nara modeled on Prince Shotoku's legendary flying pet dog.",
    },
    # --- Verified Iconic Japanese Prefectural/Cultural Mascots (not in GP CSV) ---
    {
        "gp_id": None, "id": "hikonyan-25", "name_en": "Hikonyan", "name_jp": "ひこにゃん",
        "jis_code": "25", "municipality_en": "Hikone", "year": 2006,
        "primary_trait": "cat", "secondary_traits": ["samurai"],
        "primary_color": "#F8FAFC", "accent_color": "#DC2626",
        "bio_en": "Iconic white cat of Hikone Castle wearing Lord Ii Naomasa's crimson horned samurai helmet; sparked the yuru-chara boom.",
    },
    {
        "gp_id": None, "id": "sento-kun-29", "name_en": "Sento-kun", "name_jp": "せんとくん",
        "jis_code": "29", "municipality_en": "Nara", "year": 2008,
        "primary_trait": "deer", "secondary_traits": ["fairy"],
        "primary_color": "#D97706", "accent_color": "#FACC15",
        "bio_en": "Official Nara Prefecture mascot blending a Buddhist boy with Nara Park deer antlers for Heijo-kyo's 1300th anniversary.",
    },
    {
        "gp_id": None, "id": "domo-kun-13", "name_en": "Domo-kun", "name_jp": "どーもくん",
        "jis_code": "13", "municipality_en": "Shibuya", "year": 1998,
        "primary_trait": "oni", "secondary_traits": [],
        "primary_color": "#78350F", "accent_color": "#DC2626",
        "bio_en": "Fuzzy brown open-mouthed creature hatched from an egg; Tokyo's globally beloved NHK broadcaster mascot since 1998.",
    },
    {
        "gp_id": None, "id": "kobaton-11", "name_en": "Kobaton", "name_jp": "コバトン",
        "jis_code": "11", "municipality_en": "Saitama", "year": 2000,
        "primary_trait": "bird", "secondary_traits": [],
        "primary_color": "#8B5CF6", "accent_color": "#FACC15",
        "bio_en": "Official mascot of Saitama Prefecture modeled on the Eurasian collared dove, the prefectural bird.",
    },
    {
        "gp_id": None, "id": "chiba-kun-12", "name_en": "Chiba-kun", "name_jp": "チーバくん",
        "jis_code": "12", "municipality_en": "Chiba", "year": 2007,
        "primary_trait": "dog", "secondary_traits": [],
        "primary_color": "#E3350D", "accent_color": "#FACC15",
        "bio_en": "Official crimson mascot of Chiba Prefecture whose side profile matches the exact map shape of Chiba.",
    },
    {
        "gp_id": "533", "id": "sudachi-kun-36", "name_en": "Sudachi-kun", "name_jp": "すだちくん",
        "jis_code": "36", "municipality_en": "Tokushima", "year": 1993,
        "primary_trait": "citrus", "secondary_traits": [],
        "primary_color": "#16A34A", "accent_color": "#FEF08A",
        "bio_en": "Pioneer Tokushima Prefecture mascot modeled on local sudachi citrus; one of Japan's earliest prefectural yuru-chara.",
    },
    {
        "gp_id": None, "id": "mozuyan-27", "name_en": "Mozuyan", "name_jp": "もずやん",
        "jis_code": "27", "municipality_en": "Osaka", "year": 1993,
        "primary_trait": "bird", "secondary_traits": [],
        "primary_color": "#F97316", "accent_color": "#2563EB",
        "bio_en": "Osaka Prefecture's official bull-headed shrike mascot, originally debuted in 1993 for the National Sports Festival.",
    },
    {
        "gp_id": "111", "id": "kibitan-07", "name_en": "Kibitan", "name_jp": "キビタン",
        "jis_code": "07", "municipality_en": "Fukushima", "year": 1995,
        "primary_trait": "bird", "secondary_traits": [],
        "primary_color": "#FACC15", "accent_color": "#1F2937",
        "bio_en": "Official mascot of Fukushima Prefecture inspired by the yellow-and-black narcissus flycatcher.",
    },
    {
        "gp_id": None, "id": "fujippi-22", "name_en": "Fujippi", "name_jp": "ふじっぴー",
        "jis_code": "22", "municipality_en": "Shizuoka", "year": 2000,
        "primary_trait": "mountain", "secondary_traits": [],
        "primary_color": "#2563EB", "accent_color": "#F97316",
        "bio_en": "Official Mount Fuji mascot of Shizuoka Prefecture created for the 2003 Wakafuji National Sports Festival.",
    },
    {
        "gp_id": "67", "id": "habatan-28", "name_en": "Habatan", "name_jp": "はばタン",
        "jis_code": "28", "municipality_en": "Kobe", "year": 2003,
        "primary_trait": "bird", "secondary_traits": ["dragon"],
        "primary_color": "#FACC15", "accent_color": "#DC2626",
        "bio_en": "Golden phoenix mascot of Hyogo Prefecture symbolizing rebirth and resilience after the 1995 Kobe earthquake.",
    },
    {
        "gp_id": None, "id": "momocchi-33", "name_en": "Momocchi", "name_jp": "ももっち",
        "jis_code": "33", "municipality_en": "Okayama", "year": 2003,
        "primary_trait": "peach", "secondary_traits": ["samurai"],
        "primary_color": "#FB7185", "accent_color": "#FACC15",
        "bio_en": "Official Okayama Prefecture mascot inspired by the legendary peach-born folk hero Momotaro.",
    },
    {
        "gp_id": None, "id": "mahae-chan-47", "name_en": "Mahae-chan", "name_jp": "マハエちゃん",
        "jis_code": "47", "municipality_en": "Naha", "year": 2003,
        "primary_trait": "flower", "secondary_traits": ["fairy"],
        "primary_color": "#EC4899", "accent_color": "#06B6D4",
        "bio_en": "Official Okinawa tourism ambassador adorned with vibrant tropical hibiscus blossoms and ocean colors.",
    },
    {
        "gp_id": "89", "id": "hassuru-komon-08", "name_en": "Hassuru Komon", "name_jp": "ハッスル黄門",
        "jis_code": "08", "municipality_en": "Mito", "year": 2005,
        "primary_trait": "samurai", "secondary_traits": [],
        "primary_color": "#7C3AED", "accent_color": "#FACC15",
        "bio_en": "Energetic Ibaraki Prefecture mascot modeled on the famous Edo-era lord Mito Komon.",
    },
    {
        "gp_id": None, "id": "tokki-15", "name_en": "Tokki", "name_jp": "トッキッキ",
        "jis_code": "15", "municipality_en": "Niigata", "year": 2006,
        "primary_trait": "bird", "secondary_traits": ["rice"],
        "primary_color": "#FB7185", "accent_color": "#F8FAFC",
        "bio_en": "Official Niigata Prefecture mascot inspired by the endangered Japanese crested ibis of Sado Island.",
    },
    {
        "gp_id": "1172", "id": "mejiron-44", "name_en": "Mejiron", "name_jp": "めじろん",
        "jis_code": "44", "municipality_en": "Oita", "year": 2006,
        "primary_trait": "bird", "secondary_traits": [],
        "primary_color": "#65A30D", "accent_color": "#FACC15",
        "bio_en": "Official Oita Prefecture mascot modeled on the bright olive-green Japanese white-eye songbird.",
    },
    {
        "gp_id": None, "id": "sobatchi-03", "name_en": "Sobatchi", "name_jp": "そばっち",
        "jis_code": "03", "municipality_en": "Morioka", "year": 2007,
        "primary_trait": "noodle", "secondary_traits": ["ceramic"],
        "primary_color": "#DC2626", "accent_color": "#1F2937",
        "bio_en": "Lead character of Iwate's Wanko Brothers, combining traditional lacquerware bowls with Morioka wanko soba.",
    },
    {
        "gp_id": None, "id": "kii-chan-30", "name_en": "Kii-chan", "name_jp": "きいちゃん",
        "jis_code": "30", "municipality_en": "Wakayama", "year": 2008,
        "primary_trait": "dog", "secondary_traits": ["tree"],
        "primary_color": "#22C55E", "accent_color": "#FACC15",
        "bio_en": "Official Wakayama Prefecture Kishu dog mascot painted bright green for the lush Kii Peninsula forests.",
    },
    {
        "gp_id": "2240", "id": "minamo-21", "name_en": "Minamo", "name_jp": "ミナモ",
        "jis_code": "21", "municipality_en": "Gifu", "year": 2008,
        "primary_trait": "water", "secondary_traits": ["fairy"],
        "primary_color": "#0EA5E9", "accent_color": "#FACC15",
        "bio_en": "Sparkling water-surface fairy representing Gifu Prefecture's clear mountain rivers.",
    },
    {
        "gp_id": "1414", "id": "kanagawa-kintaro-14", "name_en": "Kanagawa Kintaro", "name_jp": "かながわキンタロウ",
        "jis_code": "14", "municipality_en": "Yokohama", "year": 2008,
        "primary_trait": "samurai", "secondary_traits": ["bear"],
        "primary_color": "#DC2626", "accent_color": "#F59E0B",
        "bio_en": "Official Kanagawa mascot modeled on folk hero Kintaro of Mount Ashigara, legendary friend of bears.",
    },
    {
        "gp_id": None, "id": "kitokito-kun-16", "name_en": "Kitokito-kun", "name_jp": "きときと君",
        "jis_code": "16", "municipality_en": "Toyama", "year": 2009,
        "primary_trait": "fish", "secondary_traits": ["mountain"],
        "primary_color": "#0284C7", "accent_color": "#FACC15",
        "bio_en": "Fresh Toyama Bay yellowtail mascot promoting the Hokuriku Shinkansen and Tateyama Alpine views.",
    },
    {
        "gp_id": None, "id": "tsubo-samurai-41", "name_en": "Tsubo-samurai", "name_jp": "つぼ侍",
        "jis_code": "41", "municipality_en": "Saga", "year": 2009,
        "primary_trait": "ceramic", "secondary_traits": ["samurai"],
        "primary_color": "#2563EB", "accent_color": "#F8FAFC",
        "bio_en": "Saga Prefecture tourism samurai with an Arita blue-and-white porcelain vase for a head.",
    },
    {
        "gp_id": None, "id": "ikube-02", "name_en": "Ikube", "name_jp": "いくべぇ",
        "jis_code": "02", "municipality_en": "Aomori", "year": 2010,
        "primary_trait": "fairy", "secondary_traits": ["apple", "flower"],
        "primary_color": "#22C55E", "accent_color": "#EF4444",
        "bio_en": "Forest fairy of Aomori tourism wearing an apple-blossom hat and tail shaped like Lake Towada.",
    },
    {
        "gp_id": "392", "id": "kyun-chan-01", "name_en": "Kyun-chan", "name_jp": "キュンちゃん",
        "jis_code": "01", "municipality_en": "Sapporo", "year": 2011,
        "primary_trait": "rabbit", "secondary_traits": ["deer"],
        "primary_color": "#94A3B8", "accent_color": "#B45309",
        "bio_en": "Official Hokkaido tourism mascot: a shy Ezo pika rabbit disguised in a Hokkaido deer hood.",
    },
    {
        "gp_id": "624", "id": "takeda-hishimaru-19", "name_en": "Takeda Hishimaru", "name_jp": "武田菱丸",
        "jis_code": "19", "municipality_en": "Kofu", "year": 2011,
        "primary_trait": "dog", "secondary_traits": ["samurai"],
        "primary_color": "#B91C1C", "accent_color": "#FACC15",
        "bio_en": "Official Yamanashi Kai Ken dog mascot dressed in warlord Takeda Shingen's iconic crimson armor.",
    },
    {
        "gp_id": "359", "id": "miyazaki-ken-45", "name_en": "Miyazaki-ken", "name_jp": "みやざき犬",
        "jis_code": "45", "municipality_en": "Miyazaki", "year": 2011,
        "primary_trait": "dog", "secondary_traits": ["citrus"],
        "primary_color": "#FACC15", "accent_color": "#22C55E",
        "bio_en": "Dancing official dog mascot of Miyazaki Prefecture wearing Hyuganatsu citrus and tropical palm hats.",
    },
    {
        "gp_id": "488", "id": "ganba-kun-42", "name_en": "Ganba-kun", "name_jp": "がんばくん",
        "jis_code": "42", "municipality_en": "Nagasaki", "year": 2011,
        "primary_trait": "bird", "secondary_traits": [],
        "primary_color": "#EA580C", "accent_color": "#0284C7",
        "bio_en": "Official Nagasaki Prefecture mandarin-duck mascot cheering on sports and regional hospitality.",
    },
    {
        "gp_id": None, "id": "mayumaro-26", "name_en": "Mayumaro", "name_jp": "まゆまろ",
        "jis_code": "26", "municipality_en": "Kyoto", "year": 2011,
        "primary_trait": "fairy", "secondary_traits": [],
        "primary_color": "#F8FAFC", "accent_color": "#9333EA",
        "bio_en": "Silk-cocoon PR captain of Kyoto Prefecture celebrating traditional Nishijin textiles and culture.",
    },
    {
        "gp_id": "959", "id": "okazaemon-23", "name_en": "Okazaemon", "name_jp": "オカザえもん",
        "jis_code": "23", "municipality_en": "Okazaki", "year": 2012,
        "primary_trait": "fairy", "secondary_traits": ["castle"],
        "primary_color": "#1F2937", "accent_color": "#F8FAFC",
        "bio_en": "Cult-favorite monochrome art mascot of Okazaki, Aichi whose face spells the kanji for Okazaki.",
    },
    {
        "gp_id": None, "id": "hyakumansan-17", "name_en": "Hyakumansan", "name_jp": "ひゃくまんさん",
        "jis_code": "17", "municipality_en": "Kanazawa", "year": 2013,
        "primary_trait": "ceramic", "secondary_traits": ["samurai"],
        "primary_color": "#EAB308", "accent_color": "#DC2626",
        "bio_en": "Gold-leaf Kutani ceramic daruma mascot of Ishikawa Prefecture created for the Hokuriku Shinkansen.",
    },
    {
        "gp_id": None, "id": "rapt-18", "name_en": "Rapt (Juratic)", "name_jp": "ラプト",
        "jis_code": "18", "municipality_en": "Katsuyama", "year": 2014,
        "primary_trait": "dragon", "secondary_traits": [],
        "primary_color": "#16A34A", "accent_color": "#FACC15",
        "bio_en": "Official Fukui Prefecture dinosaur mascot modeled on the locally excavated Fukuiraptor.",
    },
    {
        "gp_id": None, "id": "aooni-kun-37", "name_en": "Shinsetsu-na Aooni-kun", "name_jp": "親切な青鬼くん",
        "jis_code": "37", "municipality_en": "Takamatsu", "year": 2002,
        "primary_trait": "oni", "secondary_traits": [],
        "primary_color": "#2563EB", "accent_color": "#FACC15",
        "bio_en": "Friendly blue ogre mascot of Kagawa Prefecture tourism inspired by the Onigashima legend of Megijima.",
    },
    {
        "gp_id": "413", "id": "tochimaru-kun-09", "name_en": "Tochimaru-kun", "name_jp": "とちまるくん",
        "jis_code": "09", "municipality_en": "Utsunomiya", "year": 2011,
        "primary_trait": "tree", "secondary_traits": [],
        "primary_color": "#B45309", "accent_color": "#FACC15",
        "bio_en": "Official Tochigi Prefecture mascot modeled on a glossy horse chestnut (tochinomi) seed.",
    },
]

# Weighted keyword patterns for extracting traits from real mascot names + descriptions
# Format: trait -> list of (regex_pattern, weight)
TRAIT_PATTERNS: dict[str, list[tuple[str, float]]] = {
    "bear": [
        (r"\bbear\b|\bbears\b|\bkuma\b|kuma(?=[-\s]|mon|chan|kun|kichi|zo|tan)", 3.5),
        (r"\bgrizzly\b|\bpanda\b|\bpolar bear\b|\bblack bear\b", 3.0),
    ],
    "cat": [
        (r"\bcat\b|\bcats\b|\bkitten\b|\bkitty\b|\bfeline\b", 3.5),
        (r"\bneko\b|\bnyan\b|nyan(?:ko|maru|ta|chan|kun)|meow|\bcalico\b|\bmaneki\b", 3.2),
    ],
    "dog": [
        (r"\bdog\b|\bdogs\b|\bpuppy\b|\bpooch\b|\bhound\b|\bshiba\b|\bakita dog\b|\bterrier\b", 3.5),
        (r"\binu\b|\bwanko\b|\bwanchan\b|\bwolf\b|\bcanine\b", 3.0),
    ],
    "rabbit": [
        (r"\brabbit\b|\bbunny\b|\bhare\b|\bpika\b", 3.5),
        (r"\busagi\b|\busa(?=[-\s]|pi|pyon|chan|maru)|\bpyon\b", 2.8),
    ],
    "raccoon": [
        (r"\braccoon\b|\btanuki\b|\bbadger\b|\botter\b|\bweasel\b|\bsquirrel\b|\bmomonga\b|\bferret\b", 3.5),
        (r"\bponpoko\b|\bmujina\b", 3.0),
    ],
    "fox": [
        (r"\bfox\b|\bfoxes\b|\bkitsune\b|\binari\b", 3.8),
    ],
    "deer": [
        (r"\bdeer\b|\bfawn\b|\bantler\b|\bantlers\b|\bserow\b|\bkamoshika\b|\breindeer\b", 3.8),
        (r"\bshika\b", 3.2),
    ],
    "cow": [
        (r"\bcow\b|\bcows\b|\bcattle\b|\bbull\b|\bcalf\b|\bwagyu\b|\bbeef\b|\bdairy\b|\bmilk\b|\bboar\b|\bpig\b|\bpiglet\b", 3.2),
        (r"\bushi\b|\bgyu\b|\bbuta\b", 2.8),
    ],
    "horse": [
        (r"\bhorse\b|\bpony\b|\bcolt\b|\bfoal\b|\bpegasus\b|\bunicorn\b|\bstallion\b", 3.6),
        (r"\buma\b", 2.8),
    ],
    "bird": [
        (r"\bbird\b|\bchick\b|\bchicken\b|\bowl\b|\bduck\b|\bcrane\b|\bswan\b|\bpigeon\b|\bdove\b|\bheron\b|\bibis\b|\bsparrow\b|\bseagull\b|\bpenguin\b|\bhawk\b|\beagle\b|\bpheasant\b|\bswallow\b|\bphoenix\b|\bcrow\b", 3.4),
        (r"\btori\b|\bpiyo\b|\bfukurou\b|\bkamome\b|\btsuru\b", 2.8),
    ],
    "fish": [
        (r"\bfish\b|\bwhale\b|\bdolphin\b|\bshark\b|\boctopus\b|\bsquid\b|\bcrab\b|\bshrimp\b|\beel\b|\bsalmon\b|\btuna\b|\bbonito\b|\bsea bream\b|\bkoi\b|\bgoldfish\b|\bshellfish\b|\bclam\b|\boyster\b|\bscallop\b|\bseal\b|\bsea lion\b", 3.4),
        (r"\bsakana\b|\btai\b|\bkani\b|\btako\b|\bunagi\b|\bika\b|\bkujira\b|\bayu\b", 2.8),
    ],
    "frog": [
        (r"\bfrog\b|\btadpole\b|\btoad\b|\bsalamander\b", 3.8),
        (r"\bkaeru\b|\bkero\b", 3.2),
    ],
    "turtle": [
        (r"\bturtle\b|\btortoise\b|\bterrapin\b|\bkame\b", 3.8),
    ],
    "citrus": [
        (r"\bcitrus\b|\bmikan\b|\bmandarin\b|\borange\b|\byuzu\b|\blemon\b|\bsudachi\b|\bkabosu\b|\bgrapefruit\b|\btangerine\b|\bdekopon\b", 3.6),
    ],
    "apple": [
        (r"\bapple\b|\bapples\b|\bpear\b|\bpears\b|\bnashi\b|\bringo\b", 3.6),
    ],
    "peach": [
        (r"\bpeach\b|\bpeaches\b|\bmomotaro\b|\bcherry\b|\bcherries\b|\bplum\b|\bume\b|\bstrawberry\b|\bstrawberries\b|\bgrape\b|\bgrapes\b|\bpersimmon\b", 3.2),
    ],
    "melon": [
        (r"\bmelon\b|\bwatermelon\b|\bpumpkin\b|\bsquash\b|\bgourd\b", 3.6),
    ],
    "rice": [
        (r"\brice\b|\bonigiri\b|\bmochi\b|\bsake\b|\bgrain\b|\bwheat\b|\bbarley\b|\bbento\b|\bsushi\b|\bdango\b|\bbean\b|\bsoy\b|\bmiso\b", 3.2),
        (r"\bkome\b|\bmusubi\b", 2.8),
    ],
    "noodle": [
        (r"\budon\b|\bramen\b|\bsoba\b|\bnoodle\b|\bnoodles\b|\byakisoba\b|\bgyoza\b|\bcurry\b|\btakoyaki\b|\bokonomiyaki\b", 3.6),
    ],
    "flower": [
        (r"\bflower\b|\bblossom\b|\bsakura\b|\bcherry blossom\b|\btulip\b|\brose\b|\blotus\b|\blily\b|\bsunflower\b|\bcamellia\b|\bchrysanthemum\b|\bhydrangea\b|\bazalea\b|\bcosmos\b|\blavender\b|\bpetal\b", 3.3),
        (r"\bhana\b|\btsubaki\b", 2.6),
    ],
    "tree": [
        (r"\btree\b|\bforest\b|\bcedar\b|\bpine\b|\bbamboo\b|\bleaf\b|\bleaves\b|\bmaple\b|\bacorn\b|\bchestnut\b|\btea\b|\bmatcha\b|\bgreen onion\b|\bonion\b|\bcarrot\b|\bradishes?\b|\bvegetable\b|\bmushroom\b|\bgarlic\b|\bpotato\b", 2.9),
        (r"\bsugi\b|\bmatsu\b|\bmori\b|\bnegi\b", 2.6),
    ],
    "samurai": [
        (r"\bsamurai\b|\bwarlord\b|\bshogun\b|\bdaimyo\b|\bwarrior\b|\barmor\b|\bhelmet\b|\bkabuto\b|\bsword\b|\bkatana\b|\bfeudal\b|\blord\b|\bieyasu\b|\bnobunaga\b|\bmasamune\b|\bshingen\b|\bsanada\b|\bknight\b", 3.5),
        (r"\bbusho\b|\btono\b|\bmaru\b(?=.*castle)", 2.8),
    ],
    "ninja": [
        (r"\bninja\b|\bshinobi\b|\bkunoichi\b|\bshuriken\b|\bstealth\b", 4.0),
    ],
    "dragon": [
        (r"\bdragon\b|\bdinosaur\b|\bfossil\b|\bmonster\b|\bkaiju\b|\bt-rex\b|\btyrannosaur\b|\braptor\b|\bserpent\b|\bsnake\b", 3.5),
        (r"\bryu\b|\btatsu\b", 2.9),
    ],
    "kappa": [
        (r"\bkappa\b|\bwater imp\b|\briver sprite\b", 4.2),
    ],
    "oni": [
        (r"\boni\b|\bogre\b|\bdemon\b|\byokai\b|\byoukai\b|\btengu\b|\bnamahage\b|\bgoblin\b|\bghost\b|\bshisa\b|\bkomainu\b|\blion dance\b", 3.6),
    ],
    "fairy": [
        (r"\bfairy\b|\bspirit\b|\belf\b|\bangel\b|\bsprite\b|\bgoddess\b|\bdeity\b|\bguardian\b|\bprincess\b|\bprince\b|\bmagic\b|\bwizard\b", 2.9),
        (r"\byousei\b|\bkami\b", 2.6),
    ],
    "mountain": [
        (r"\bmountain\b|\bmount\b|\bmt\.\b|\bfuji\b|\bvolcano\b|\balps\b|\bpeak\b|\bhighland\b|\bhill\b|\bsnow\b|\bice\b|\bski\b|\bvalley\b", 3.0),
        (r"\byama\b|\bsan\b(?=.*peak|.*volcano)", 2.5),
    ],
    "water": [
        (r"\bwater\b|\briver\b|\bsea\b|\bocean\b|\bwave\b|\blake\b|\bhot spring\b|\bonsen\b|\bwaterfall\b|\bstream\b|\bcloud\b|\brain\b|\bdrop\b|\bmaritime\b|\bharbor\b|\bport\b|\bisland\b|\bcoast\b|\bbeach\b", 2.8),
        (r"\bmizu\b|\bkawa\b|\bumi\b|\bshizuku\b", 2.5),
    ],
    "castle": [
        (r"\bcastle\b|\bshrine\b|\btemple\b|\btower\b|\bbridge\b|\bgate\b|\btorii\b|\bpalace\b|\bpagoda\b|\bfortress\b|\bruins\b|\bstation\b|\btrain\b|\brailway\b", 2.9),
        (r"\bshiro\b|\bjo\b(?=.*castle)", 2.5),
    ],
    "star": [
        (r"\bstar\b|\bstars\b|\bspace\b|\bplanet\b|\bmoon\b|\bsun\b|\bsunshine\b|\bcosmos\b|\bgalaxy\b|\bcomet\b|\bheart\b|\bmusic\b|\brainbow\b|\bspark\b|\blight\b|\bflame\b|\bfire\b", 2.8),
        (r"\bhoshi\b|\bginga\b", 2.6),
    ],
    "ceramic": [
        (r"\bceramic\b|\bpottery\b|\bporcelain\b|\bhaniwa\b|\bclay\b|\bdaruma\b|\bkokeshi\b|\bdoll\b|\bcraft\b|\blacquer\b|\btile\b|\bpaper\b|\borigami\b|\bglass\b|\btextile\b|\btowel\b|\bdrum\b|\bbell\b|\bcoin\b|\bmask\b|\blantern\b|\brobot\b|\bstone\b|\brock\b", 3.0),
        (r"\byaki\b|\bningyo\b", 2.6),
    ],
}

# Color keywords -> (primary_hex, accent_hex)
COLOR_HINTS: list[tuple[str, str, str]] = [
    (r"\bblack\b|\bkuro\b|\bcharcoal\b", "#1F2937", "#EF4444"),
    (r"\bred\b|\bcrimson\b|\bvermilion\b|\bscarlet\b|\baka\b", "#DC2626", "#FACC15"),
    (r"\bpink\b|\bsakura\b|\bpeach\b|\bcherry blossom\b|\bmagenta\b", "#EC4899", "#FDE68A"),
    (r"\borange\b|\bmikan\b|\bmandarin\b|\btangerine\b", "#F97316", "#FACC15"),
    (r"\byellow\b|\bgold\b|\bgolden\b|\bamber\b|\bsunshine\b", "#EAB308", "#1E3A8A"),
    (r"\bgreen\b|\bemerald\b|\bleaf\b|\bforest\b|\bmatcha\b|\bmidori\b", "#16A34A", "#FACC15"),
    (r"\bblue\b|\bazure\b|\bocean\b|\bsky\b|\bsea\b|\baqua\b|\bao\b", "#0284C7", "#FACC15"),
    (r"\bpurple\b|\bviolet\b|\blavender\b|\bgrape\b|\bmurasaki\b", "#7C3AED", "#F9A8D4"),
    (r"\bwhite\b|\bsnow\b|\bshiro\b|\bsilver\b", "#64748B", "#38BDF8"),
    (r"\bbrown\b|\bchestnut\b|\bchocolate\b|\bwood\b", "#92400E", "#FDE047"),
]

URL_STRIP_RE = re.compile(
    r"https?://\s*\S+|www\.\s*\S+|\b[a-z0-9][a-z0-9.-]*\.(?:jp|com|net|org|co\.jp|ne\.jp|or\.jp|go\.jp|html|php|jpg|jpeg|png|gif|webp|svg)\b(?:/\S*)?",
    re.IGNORECASE,
)
NON_ASCII_NOISE_RE = re.compile(r"[♪♫☆★♥♡◆◇■□●○▲△▼▽※→←↑↓⇒⇐◎◉○×]+")
KAOMOJI_RE = re.compile(r"[A-Za-z]?\([^)]{1,14}\)[A-Za-z♪!]*")
BAD_NAME_WORDS = {
    "had", "sucky", "maybe", "mix", "repeat", "twist", "try", "cat", "dog", "bear", "bird",
    "horse", "fish", "tree", "flower", "water", "rice", "apple", "peach", "melon",
}


def fetch_or_cache(url: str, filename: str) -> bytes:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = CACHE_DIR / filename
    if cached.exists() and cached.stat().st_size > 0:
        return cached.read_bytes()
    req = urllib.request.Request(url, headers={"User-Agent": "YuruDex-ETL/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    cached.write_bytes(data)
    return data


# -------------------- GEOMETRY HELPERS --------------------

def polygon_ring_area(ring: list[list[float]]) -> float:
    """Unsigned shoelace area in deg^2."""
    n = len(ring)
    if n < 3:
        return 0.0
    acc = 0.0
    for i in range(n - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        acc += x1 * y2 - x2 * y1
    return abs(acc) * 0.5


def polygon_ring_centroid(ring: list[list[float]]) -> tuple[float, float]:
    """Area-weighted centroid (lng, lat) of a closed ring."""
    n = len(ring)
    if n < 3:
        return (ring[0][0], ring[0][1])
    signed_area = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(n - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        cross = x1 * y2 - x2 * y1
        signed_area += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    signed_area *= 0.5
    if abs(signed_area) < 1e-12:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return (sum(xs) / len(xs), sum(ys) / len(ys))
    return (cx / (6.0 * signed_area), cy / (6.0 * signed_area))


def perp_distance(pt: list[float], start: list[float], end: list[float]) -> float:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    if dx == 0.0 and dy == 0.0:
        return math.hypot(pt[0] - start[0], pt[1] - start[1])
    t = ((pt[0] - start[0]) * dx + (pt[1] - start[1]) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    proj_x = start[0] + t * dx
    proj_y = start[1] + t * dy
    return math.hypot(pt[0] - proj_x, pt[1] - proj_y)


def douglas_peucker(pts: list[list[float]], eps: float) -> list[list[float]]:
    if len(pts) <= 2:
        return pts
    max_d = -1.0
    idx = 0
    start, end = pts[0], pts[-1]
    for i in range(1, len(pts) - 1):
        d = perp_distance(pts[i], start, end)
        if d > max_d:
            max_d = d
            idx = i
    if max_d > eps:
        left = douglas_peucker(pts[: idx + 1], eps)
        right = douglas_peucker(pts[idx:], eps)
        return left[:-1] + right
    return [start, end]


def simplify_ring(ring: list[list[float]], eps: float) -> list[list[float]] | None:
    if len(ring) < 4:
        return None
    # Split closed ring at farthest point from start so DP preserves closed loop cleanly
    start = ring[0]
    far_idx = max(range(1, len(ring) - 1), key=lambda i: (ring[i][0] - start[0]) ** 2 + (ring[i][1] - start[1]) ** 2)
    h1 = douglas_peucker(ring[: far_idx + 1], eps)
    h2 = douglas_peucker(ring[far_idx:], eps)
    merged = h1[:-1] + h2

    # Round to 3 decimal places and deduplicate consecutive identical points
    cleaned: list[list[float]] = []
    for p in merged:
        rp = [round(p[0], 3), round(p[1], 3)]
        if not cleaned or cleaned[-1] != rp:
            cleaned.append(rp)
    if len(cleaned) < 3:
        return None
    if cleaned[0] != cleaned[-1]:
        cleaned.append(cleaned[0])
    if len(cleaned) < 4:
        return None
    return cleaned


def build_geojson_and_adjacency() -> tuple[dict[str, Any], dict[str, Any]]:
    raw_bytes = fetch_or_cache(GEOJSON_URL, "japan_raw.geojson")
    raw_gj = json.loads(raw_bytes.decode("utf-8"))

    # Geographic bounds filter for extreme distant Pacific islets that break silhouettes/centroids
    def keep_polygon(jis: str, outer_ring: list[list[float]]) -> bool:
        lng, lat = polygon_ring_centroid(outer_ring)
        if jis == "13":  # Tokyo: keep mainland Tokyo (exclude Ogasawara/Izu distant islands)
            return lat >= 35.4 and lng <= 140.2
        if jis == "01":  # Hokkaido: keep Hokkaido + Rishiri/Rebun/Okushiri (exclude distant Kurils)
            return lng <= 146.0
        if jis == "46":  # Kagoshima: keep mainland + Yakushima/Tanegashima so it stays clear of Okinawa inset
            return lat >= 29.8
        if jis == "47":  # Okinawa: keep main Ryukyu chain (Okinawa Honto, Miyako, Ishigaki, Iriomote, Kume)
            return 123.5 <= lng <= 130.5 and 24.0 <= lat <= 27.5
        return True

    # Tune simplification epsilon & min island area so file lands cleanly in ~105-145 KB
    eps = 0.0085
    min_island_area = 0.0018

    features: list[dict[str, Any]] = []
    centroids_by_jis: dict[str, list[float]] = {}

    for feat in raw_gj["features"]:
        fid = int(feat["properties"]["id"])
        jis = f"{fid:02d}"
        meta = PREFECTURES[jis]
        geom = feat["geometry"]
        raw_polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]

        # Filter distant islets & compute areas
        scored_polys: list[tuple[float, list[list[list[float]]]]] = []
        for poly in raw_polys:
            outer = poly[0]
            if keep_polygon(jis, outer):
                scored_polys.append((polygon_ring_area(outer), poly))
        if not scored_polys:
            # Fallback: keep all if filter emptied (should never happen)
            scored_polys = [(polygon_ring_area(p[0]), p) for p in raw_polys]

        scored_polys.sort(key=lambda x: x[0], reverse=True)

        # Compute clean centroid on the largest mainland polygon
        main_lng, main_lat = polygon_ring_centroid(scored_polys[0][1][0])
        centroids_by_jis[jis] = [round(main_lat, 3), round(main_lng, 3)]

        # Simplify retained polygons
        out_polys: list[list[list[list[float]]]] = []
        for idx, (area, poly) in enumerate(scored_polys):
            # Always keep the largest polygon; keep secondary islands above threshold (max 8 islands per pref)
            if idx > 0 and (area < min_island_area or len(out_polys) >= 8):
                continue
            outer_s = simplify_ring(poly[0], eps)
            if outer_s is None and idx == 0:
                outer_s = simplify_ring(poly[0], eps * 0.35)
            if outer_s is None:
                continue
            rings = [outer_s]
            # Keep major lakes/holes if present and substantial
            for hole in poly[1:]:
                if polygon_ring_area(hole) >= min_island_area * 2:
                    hole_s = simplify_ring(hole, eps)
                    if hole_s is not None:
                        rings.append(hole_s)
            out_polys.append(rings)

        if len(out_polys) == 1:
            new_geom = {"type": "Polygon", "coordinates": out_polys[0]}
        else:
            new_geom = {"type": "MultiPolygon", "coordinates": out_polys}

        features.append({
            "type": "Feature",
            "properties": {
                "jis_code": jis,
                "name_en": meta["name_en"],
                "name_jp": meta["name_jp"],
                "region_en": meta["region_en"],
            },
            "geometry": new_geom,
        })

    features.sort(key=lambda f: f["properties"]["jis_code"])
    geojson_obj = {"type": "FeatureCollection", "features": features}

    # Build symmetric adjacency map
    nb_map: dict[str, set[str]] = {f"{i:02d}": set() for i in range(1, 48)}
    for a, b in ADJACENCY_EDGES:
        nb_map[a].add(b)
        nb_map[b].add(a)

    adjacency_obj: dict[str, Any] = {}
    for i in range(1, 48):
        jis = f"{i:02d}"
        meta = PREFECTURES[jis]
        adjacency_obj[jis] = {
            "jis_code": jis,
            "name_en": meta["name_en"],
            "name_jp": meta["name_jp"],
            "region_en": meta["region_en"],
            "neighbors": sorted(nb_map[jis]),
            "centroid": centroids_by_jis[jis],
        }

    return geojson_obj, adjacency_obj


# -------------------- MASCOT EXTRACTION HELPERS --------------------

def area_to_jis(area: str) -> str | None:
    s = area.strip().lower()
    if not s or s == "overseas":
        return None
    s = re.sub(r"\s+prefecture$", "", s).strip()
    return NAME_TO_JIS.get(s)


def clean_name(raw_name: str, prefecture_en: str) -> str:
    s = raw_name.strip()
    s = URL_STRIP_RE.sub("", s)
    s = NON_ASCII_NOISE_RE.sub("", s)
    s = KAOMOJI_RE.sub("", s)
    s = s.replace("“", '"').replace("”", '"').replace("「", '"').replace("」", '"')
    s = re.sub(r"\s+", " ", s).strip()
    # Extract quoted mascot name when wrapped in a descriptive title
    m = re.search(r'"([^"]{2,32})"', s)
    if m and len(s) > 22:
        s = m.group(1).strip()
    # Strip trailing parenthetical subtitles like "Yuririn (Yurihama town maiden character)"
    s = re.sub(r"\s*\([^)]*\)?\s*$", "", s).strip()
    # Strip verbose official title prefixes before the mascot name
    m_after = re.search(
        r"(?:official\s+character|mascot\s+character|PR\s+character|PR\s+captain|image\s+character|tourism\s+character|sightseeing\s+PR\s+captain|mascot)\s+([A-Z\"][A-Za-z0-9\-\s'\"]{2,28})$",
        s,
        flags=re.IGNORECASE,
    )
    if m_after and len(s) > 26:
        s = m_after.group(1).strip()
    s = s.replace('"', "").strip(" ,;:-'")
    if len(s) > 36:
        s = s[:35].rsplit(" ", 1)[0].strip(" ,;:-'")
    if not s:
        s = f"{prefecture_en} Mascot"
    return s


def extract_municipality(affiliation: str, desc: str, prefecture_en: str) -> str | None:
    text = f"{affiliation} {desc[:120]}"
    m = re.search(r"\b([A-Z][a-z]{2,18}(?:-[A-Z][a-z]{2,14})?)\s+(?:City|Town|Village|Ward)\b", text)
    if m:
        cand = m.group(1)
        if cand.lower() not in {"prefecture", "japan", "tourism", "chamber", "commerce", "public", "national", "local", "central", "north", "south", "east", "west", "new", "old", "big"}:
            return cand
    return None


def clean_bio(raw_desc: str, affiliation: str, name_en: str, prefecture_en: str) -> str:
    s = raw_desc.strip() if raw_desc and raw_desc.strip() != "NA" else ""
    if s:
        s = URL_STRIP_RE.sub("", s)
        s = re.sub(r"\b(?:HP|URL|Website|Homepage)\s*(?:is|:)\s*$", "", s, flags=re.IGNORECASE)
        s = re.sub(r"^Affiliation:\s*[^.\n]{1,90}(?:\.|\s{2,})?", "", s, flags=re.IGNORECASE)
        s = re.sub(r"<[^>]+>", " ", s)
        s = NON_ASCII_NOISE_RE.sub(" ", s)
        s = KAOMOJI_RE.sub(" ", s)
        s = s.replace('""', '"').replace("\r", " ").replace("\n", " ")
        s = re.sub(r"~+", "", s)
        s = re.sub(r"\s+", " ", s).strip().strip('"').strip()
        s = re.sub(r"\b(?:HP|URL|Website)\s*(?:is|:)?\s*$", "", s, flags=re.IGNORECASE).strip()
        if len(s) > 155:
            cut = s[:155]
            sent_end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
            if sent_end >= 50:
                s = cut[: sent_end + 1].strip()
            else:
                s = cut[:152].rsplit(" ", 1)[0].rstrip(" ,;:-") + "..."
    if len(s) < 18:
        aff = affiliation.strip() if affiliation and affiliation != "NA" else ""
        aff = URL_STRIP_RE.sub("", aff)
        aff = re.sub(r"\s+", " ", aff).strip()
        if aff and len(aff) <= 75:
            s = f"Local yuru-chara representing {aff} in {prefecture_en} Prefecture."
        else:
            s = f"Regional yuru-chara mascot representing {prefecture_en} Prefecture."
    if len(s) > 158:
        s = s[:155].rsplit(" ", 1)[0].rstrip(" ,;:-") + "..."
    return s


def classify_dna(name: str, affiliation: str, desc: str) -> tuple[str, list[str], float, str, str]:
    """
    Returns (primary_trait, secondary_traits, confidence_score, primary_color, accent_color).
    """
    name_l = name.lower()
    desc_l = (desc if desc != "NA" else "").lower()
    aff_l = (affiliation if affiliation != "NA" else "").lower()
    full_l = f"{name_l} {aff_l} {desc_l}"

    scores: dict[str, float] = defaultdict(float)
    for trait, patterns in TRAIT_PATTERNS.items():
        for pat, w in patterns:
            # Matches in the mascot's own name get extra weight
            if re.search(pat, name_l):
                scores[trait] += w * 1.45
            desc_hits = len(re.findall(pat, desc_l))
            if desc_hits:
                scores[trait] += w * min(desc_hits, 2) * 0.95
            if re.search(pat, aff_l):
                scores[trait] += w * 0.45

    if not scores:
        return ("fairy", [], 0.0, TRAIT_META["fairy"][2], TRAIT_META["fairy"][3])

    ranked = sorted(scores.items(), key=lambda x: (-x[1], x[0]))
    primary_trait, top_score = ranked[0]

    # Detect authentic secondary traits (hybrids)
    secondary_traits: list[str] = []
    for trait, sc in ranked[1:]:
        if len(secondary_traits) >= 2:
            break
        # Require meaningful secondary evidence so hybrids reflect real multi-motif designs
        if sc >= 2.7 and sc >= top_score * 0.45:
            secondary_traits.append(trait)

    # Infer vibrant colors from description/name, fallback to trait curated palette
    p_col, a_col = TRAIT_META[primary_trait][2], TRAIT_META[primary_trait][3]
    for pat, hex_p, hex_a in COLOR_HINTS:
        if re.search(pat, f"{name_l} {desc_l[:260]}"):
            p_col = hex_p
            if hex_a != p_col:
                a_col = hex_a
            break
    # If hybrid and accent equals primary, blend secondary trait's signature hue as accent
    if secondary_traits:
        sec_col = TRAIT_META[secondary_traits[0]][2]
        if sec_col != p_col:
            a_col = sec_col

    return (primary_trait, secondary_traits, top_score, p_col, a_col)


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:28] or "mascot"


def build_mascots() -> list[dict[str, Any]]:
    raw_bytes = fetch_or_cache(YURUGP_URL, "yuru-gp.txt")
    text = raw_bytes.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text), delimiter="\t")

    # Deduplicate yuru-gp records by character_id
    gp_chars: dict[str, dict[str, Any]] = {}
    for row in reader:
        cid = row["character_id"].strip()
        jis = area_to_jis(row["area"])
        if jis is None:
            continue
        yr = int(row["year"])
        rk = int(row["rank"]) if row["rank"].isdigit() else 9999
        desc = row["description"].strip()
        name = row["name"].strip()
        aff = row["affiliation"].strip()

        if cid not in gp_chars:
            gp_chars[cid] = {
                "cid": cid,
                "jis_code": jis,
                "min_year": yr,
                "best_rank": rk,
                "appearances": 1,
                "name": name,
                "affiliation": aff,
                "description": desc,
            }
        else:
            rec = gp_chars[cid]
            rec["min_year"] = min(rec["min_year"], yr)
            rec["best_rank"] = min(rec["best_rank"], rk)
            rec["appearances"] += 1
            if (rec["description"] == "NA" or len(rec["description"]) < 30) and desc != "NA" and len(desc) > len(rec["description"]):
                rec["description"] = desc
            if rec["affiliation"] == "NA" and aff != "NA":
                rec["affiliation"] = aff

    # Index iconic mascots by gp_id so we never duplicate them
    iconic_by_gp: dict[str, dict[str, Any]] = {}
    selected: list[dict[str, Any]] = []
    used_ids: set[str] = set()

    def make_record(
        rec_id: str,
        name_en: str,
        name_jp: str | None,
        jis_code: str,
        municipality_en: str | None,
        year: int,
        year_type: str,
        bio_en: str,
        primary_trait: str,
        secondary_traits: list[str],
        primary_color: str,
        accent_color: str,
    ) -> dict[str, Any]:
        domain, trait_family, _, _ = TRAIT_META[primary_trait]
        sec_clean = []
        for st in secondary_traits:
            if st in TRAIT_META and st != primary_trait and st not in sec_clean:
                sec_clean.append(st)
        return {
            "id": rec_id,
            "name_en": name_en,
            "name_jp": name_jp,
            "jis_code": jis_code,
            "prefecture_en": PREFECTURES[jis_code]["name_en"],
            "municipality_en": municipality_en,
            "year": year,
            "year_type": year_type,
            "bio_en": bio_en,
            "dna": {
                "domain": domain,
                "primary_trait": primary_trait,
                "secondary_traits": sec_clean,
                "trait_family": trait_family,
                "primary_color": primary_color,
                "accent_color": accent_color,
                "is_hybrid": len(sec_clean) > 0,
            },
        }

    for ic in VERIFIED_ICONIC_MASCOTS:
        if ic["gp_id"] is not None:
            iconic_by_gp[ic["gp_id"]] = ic
        rec = make_record(
            rec_id=ic["id"],
            name_en=ic["name_en"],
            name_jp=ic["name_jp"],
            jis_code=ic["jis_code"],
            municipality_en=ic["municipality_en"],
            year=ic["year"],
            year_type="debut",
            bio_en=ic["bio_en"],
            primary_trait=ic["primary_trait"],
            secondary_traits=ic["secondary_traits"],
            primary_color=ic["primary_color"],
            accent_color=ic["accent_color"],
        )
        selected.append(rec)
        used_ids.add(rec["id"])

    # Score all remaining real yuru-gp mascots
    candidates_by_pref: dict[str, list[tuple[float, dict[str, Any]]]] = defaultdict(list)

    for cid, raw in gp_chars.items():
        if cid in iconic_by_gp:
            continue
        jis = raw["jis_code"]
        pref_en = PREFECTURES[jis]["name_en"]
        desc = raw["description"]
        if desc == "NA" or len(desc) < 25:
            continue

        # Skip corporate-only spammy gibberish or machine-translated generic single words
        c_name = clean_name(raw["name"], pref_en)
        if len(c_name) < 3 or not re.search(r"[A-Za-z]", c_name) or c_name.lower() in BAD_NAME_WORDS:
            continue

        p_trait, sec_traits, conf, p_col, a_col = classify_dna(raw["name"], raw["affiliation"], desc)
        if conf < 2.8:
            continue  # Keep high-signal mascots with clear extracted trait DNA

        bio = clean_bio(desc, raw["affiliation"], c_name, pref_en)
        muni = extract_municipality(raw["affiliation"], desc, pref_en)

        # Composite quality score: trait confidence + GP prominence + multi-year longevity + clean name
        rank_bonus = max(0.0, 6.0 - math.log10(max(raw["best_rank"], 1)) * 1.7)
        app_bonus = min(raw["appearances"], 5) * 0.45
        early_bonus = 0.8 if raw["min_year"] <= 2013 else 0.0
        quality = conf + rank_bonus + app_bonus + early_bonus

        cand = {
            "cid": cid,
            "name_en": c_name,
            "jis_code": jis,
            "municipality_en": muni,
            "year": raw["min_year"],
            "bio_en": bio,
            "primary_trait": p_trait,
            "secondary_traits": sec_traits,
            "primary_color": p_col,
            "accent_color": a_col,
            "quality": quality,
            "is_hybrid": len(sec_traits) > 0,
        }
        candidates_by_pref[jis].append((quality, cand))

    for jis in candidates_by_pref:
        candidates_by_pref[jis].sort(key=lambda x: (-x[0], x[1]["year"], x[1]["cid"]))

    # Track counts per prefecture, trait, and hybrid balance to select ~600 high-signal real mascots
    TARGET_TOTAL = 600
    MIN_PER_PREF = 9
    MAX_PER_PREF = 20

    pref_counts: Counter[str] = Counter(m["jis_code"] for m in selected)
    trait_counts: Counter[str] = Counter(m["dna"]["primary_trait"] for m in selected)
    used_cids: set[str] = set()
    used_names_per_pref: set[tuple[str, str]] = {(m["jis_code"], m["name_en"].lower()) for m in selected}

    def add_candidate(cand: dict[str, Any]) -> bool:
        key = (cand["jis_code"], cand["name_en"].lower())
        if cand["cid"] in used_cids or key in used_names_per_pref:
            return False
        base_id = f"{slugify(cand['name_en'])}-{cand['jis_code']}"
        rec_id = base_id
        if rec_id in used_ids:
            rec_id = f"{base_id}-{cand['cid']}"
        rec = make_record(
            rec_id=rec_id,
            name_en=cand["name_en"],
            name_jp=None,
            jis_code=cand["jis_code"],
            municipality_en=cand["municipality_en"],
            year=cand["year"],
            year_type="first_observed",
            bio_en=cand["bio_en"],
            primary_trait=cand["primary_trait"],
            secondary_traits=cand["secondary_traits"],
            primary_color=cand["primary_color"],
            accent_color=cand["accent_color"],
        )
        selected.append(rec)
        used_ids.add(rec_id)
        used_cids.add(cand["cid"])
        used_names_per_pref.add(key)
        pref_counts[cand["jis_code"]] += 1
        trait_counts[cand["primary_trait"]] += 1
        return True

    # Phase 1: Ensure every prefecture reaches MIN_PER_PREF with balanced hybrid & trait diversity
    for i in range(1, 48):
        jis = f"{i:02d}"
        pool = candidates_by_pref[jis]
        # Prefer diverse primary traits within each prefecture
        local_traits: Counter[str] = Counter(m["dna"]["primary_trait"] for m in selected if m["jis_code"] == jis)
        while pref_counts[jis] < MIN_PER_PREF:
            best_cand = None
            best_score = -1e9
            cur_hybrids = sum(1 for m in selected if m["dna"]["is_hybrid"])
            hybrid_ratio = cur_hybrids / max(len(selected), 1)
            for q, c in pool:
                if c["cid"] in used_cids:
                    continue
                if (jis, c["name_en"].lower()) in used_names_per_pref:
                    continue
                s = q
                # Encourage trait diversity within prefecture and across underrepresented traits
                s -= local_traits[c["primary_trait"]] * 2.2
                if trait_counts[c["primary_trait"]] < 8:
                    s += 3.0
                # Steer hybrid ratio gently toward ~30%
                if c["is_hybrid"] and hybrid_ratio > 0.34:
                    s -= 2.5
                elif c["is_hybrid"] and hybrid_ratio < 0.27:
                    s += 1.8
                if s > best_score:
                    best_score = s
                    best_cand = c
            if best_cand is None:
                break
            add_candidate(best_cand)
            local_traits[best_cand["primary_trait"]] += 1

    # Phase 2: Ensure every single one of the 32 traits has strong representation (>= 8 mascots)
    all_remaining: list[dict[str, Any]] = []
    for jis, pool in candidates_by_pref.items():
        for _, c in pool:
            if c["cid"] not in used_cids:
                all_remaining.append(c)

    for trait in sorted(TRAIT_META.keys()):
        if trait_counts[trait] >= 8:
            continue
        trait_pool = [c for c in all_remaining if c["primary_trait"] == trait and c["cid"] not in used_cids]
        trait_pool.sort(key=lambda c: (-c["quality"], c["year"]))
        for c in trait_pool:
            if trait_counts[trait] >= 8 or len(selected) >= TARGET_TOTAL:
                break
            if pref_counts[c["jis_code"]] >= MAX_PER_PREF:
                continue
            add_candidate(c)

    # Phase 3: Fill remaining slots up to TARGET_TOTAL with highest-signal mascots across Japan
    remaining_pool = [c for c in all_remaining if c["cid"] not in used_cids]
    while len(selected) < TARGET_TOTAL and remaining_pool:
        cur_hybrids = sum(1 for m in selected if m["dna"]["is_hybrid"])
        hybrid_ratio = cur_hybrids / max(len(selected), 1)

        best_idx = -1
        best_score = -1e9
        for idx, c in enumerate(remaining_pool):
            if c["cid"] in used_cids:
                continue
            if pref_counts[c["jis_code"]] >= MAX_PER_PREF:
                continue
            if (c["jis_code"], c["name_en"].lower()) in used_names_per_pref:
                continue
            s = c["quality"]
            # Gentle prefecture & trait balance
            s -= (pref_counts[c["jis_code"]] - MIN_PER_PREF) * 0.7
            if trait_counts[c["primary_trait"]] > 36:
                s -= 2.5
            elif trait_counts[c["primary_trait"]] < 12:
                s += 2.0
            if c["is_hybrid"] and hybrid_ratio > 0.33:
                s -= 3.2
            elif c["is_hybrid"] and hybrid_ratio < 0.28:
                s += 2.4
            if s > best_score:
                best_score = s
                best_idx = idx
        if best_idx < 0:
            break
        chosen = remaining_pool.pop(best_idx)
        add_candidate(chosen)

    # Sort deterministically by (year, jis_code, id)
    selected.sort(key=lambda m: (m["year"], m["jis_code"], m["id"]))
    return selected


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("1/3 Building simplified 47-prefecture GeoJSON & adjacency graph...")
    geojson_obj, adjacency_obj = build_geojson_and_adjacency()

    geo_path = OUT_DIR / "japan_prefectures.geojson"
    geo_text = json.dumps(geojson_obj, ensure_ascii=False, separators=(",", ":"))
    geo_path.write_text(geo_text, encoding="utf-8")
    print(f"    Wrote {geo_path} ({len(geo_text.encode('utf-8')) / 1024:.1f} KB)")

    adj_path = OUT_DIR / "prefecture_adjacency.json"
    adj_text = json.dumps(adjacency_obj, ensure_ascii=False, indent=2)
    adj_path.write_text(adj_text, encoding="utf-8")
    print(f"    Wrote {adj_path} ({len(adj_text.encode('utf-8')) / 1024:.1f} KB)")

    print("2/3 Extracting & enriching real Japanese mascots...")
    mascots = build_mascots()

    mascots_path = OUT_DIR / "mascots.json"
    mascots_text = json.dumps(mascots, ensure_ascii=False, separators=(",", ":"))
    mascots_path.write_text(mascots_text, encoding="utf-8")
    print(f"    Wrote {mascots_path} ({len(mascots_text.encode('utf-8')) / 1024:.1f} KB, {len(mascots)} mascots)")

    print("3/3 Done!")


if __name__ == "__main__":
    main()
