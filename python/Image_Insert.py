from pymongo import MongoClient
from urllib.parse import quote_plus
from datetime import datetime, timedelta
from bson.binary import Binary
import tkinter as tk
from tkinter import filedialog
import os

username = "inkdabba_dev"
password = "Dev1234"

username = quote_plus(username)
password = quote_plus(password)

uri = f"mongodb+srv://{username}:{password}@inkdabba.g1fmygf.mongodb.net/?appName=Inkdabba"

client = MongoClient(uri)

db = client["Posters"]
bg = db["Bgimgs"]


def get_next_start_date():
    latest_doc = bg.find_one(
        {"date": {"$exists": True}},
        sort=[("date", -1)]
    )

    if latest_doc and "date" in latest_doc:
        latest_date = datetime.strptime(latest_doc["date"], "%Y-%m-%d")
        next_date = latest_date + timedelta(days=1)
        return next_date
    else:
        # if no records exist, start from today
        return datetime.now()


def select_and_upload_images():
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    file_paths = filedialog.askopenfilenames(
        title="Select background images",
        filetypes=[
            ("Image Files", "*.png *.jpg *.jpeg *.webp *.bmp *.gif"),
            ("All Files", "*.*")
        ]
    )

    if not file_paths:
        print("No images selected.")
        return

    start_date = get_next_start_date()

    inserted_count = 0

    for index, file_path in enumerate(file_paths):
        try:
            file_name = os.path.basename(file_path)
            file_ext = os.path.splitext(file_name)[1].lower()

            assigned_date = (start_date + timedelta(days=index)).strftime("%Y-%m-%d")

            # optional: skip if same date already exists
            existing_date = bg.find_one({"type": "background", "date": assigned_date})
            if existing_date:
                print(f"Skipped date {assigned_date} (already has an image)")
                continue

            with open(file_path, "rb") as f:
                image_data = f.read()

            data = {
                "name": file_name,
                "image": Binary(image_data),
                "type": "background",
                "date": assigned_date,
                "extension": file_ext,
                "originalPath": file_path
            }

            bg.insert_one(data)
            inserted_count += 1
            print(f"Inserted: {file_name} -> {assigned_date}")

        except Exception as e:
            print(f"Failed: {file_path} -> {e}")

    print(f"\nInserted: {inserted_count}")


if __name__ == "__main__":
    select_and_upload_images()