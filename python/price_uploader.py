from selenium import webdriver
from urllib.parse import quote_plus
from selenium.webdriver.common.by import By

from pymongo import MongoClient
from datetime import datetime
import time

# ==============================
# CONFIGURATION (EDIT HERE ONLY)
# ==============================

GOLD_URL = "https://www.goodreturns.in/gold-rates/chennai.html"
SILVER_URL = "https://www.goodreturns.in/silver-rates/chennai.html"

GOLD_ID = "22K-price"
SILVER_ID = "silver-1g-price"



username = "inkdabba_dev"
password = "Dev1234"

username = quote_plus(username)
password = quote_plus(password)


MONGO_URI = f"mongodb+srv://{username}:{password}@inkdabba.g1fmygf.mongodb.net/?appName=Inkdabba"
DB_NAME = "Posters"
COLLECTION_NAME = "Prices"

# ==============================
# MongoDB Connection
# ==============================

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]

# ==============================
# Selenium Setup
# ==============================

driver = webdriver.Chrome()


def get_price(url, element_id):
    driver.get(url)
    time.sleep(3)

    element = driver.find_element(By.ID, element_id)
    value = element.get_attribute("innerHTML")

    value = value.replace("₹", "").replace(",", "").strip()

    return int(value)


# ==============================
# SCRAPE DATA
# ==============================

gold_price = get_price(GOLD_URL, GOLD_ID)
silver_price = get_price(SILVER_URL, SILVER_ID)

print("Gold:", gold_price)
print("Silver:", silver_price)

# ==============================
# CHECK LAST ENTRY
# ==============================

last = collection.find_one(sort=[("updatedAt", -1)])

if last and last["gold"] == gold_price and last["silver"] == silver_price:
    print("No change in price. Skipping insert.")
else:
    data = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "gold": gold_price,
        "silver": silver_price,
        "updatedAt": datetime.utcnow()
    }

    collection.insert_one(data)
    print("New price stored in MongoDB")

driver.quit()