from psd_tools import PSDImage
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox
import re
import os


def clean_filename(name: str) -> str:
    name = name.strip() if name else "layer"
    name = re.sub(r'[\\/*?:"<>|]', "_", name)
    return name[:150]


def export_layers(layer, output_dir: Path):
    # Skip invisible layers if needed

        
    layer_name = clean_filename(layer.name)

    # If layer is a group/folder
    if layer.is_group():
        group_dir = output_dir / layer_name
        group_dir.mkdir(parents=True, exist_ok=True)

        for child in layer:
            export_layers(child, group_dir)
        return

    # Export renderable layer
    if not layer.is_visible():
        image = layer.topil()
    else:
        image = layer.composite()
        
    if image is not None:
        output_path = output_dir / f"{layer_name}.png"
        image.save(output_path)
        print(f"Saved: {output_path}")


def main():
    # Hide main tkinter window
    root = tk.Tk()
    root.withdraw()

    # Open file picker
    input_file = filedialog.askopenfilename(
        title="Select PSD or PSB file",
        filetypes=[
            ("Photoshop Files", "*.psd *.psb"),
            ("PSD Files", "*.psd"),
            ("PSB Files", "*.psb"),
            ("All Files", "*.*")
        ]
    )

    if not input_file:
        print("No file selected.")
        return

    try:
        psd = PSDImage.open(input_file)

        input_path = Path(input_file)
        output_dir = input_path.parent / f"{input_path.stem}_layers"
        output_dir.mkdir(parents=True, exist_ok=True)

        for layer in psd:
            export_layers(layer, output_dir)

        print(f"\nDone! Layers exported to:\n{output_dir}")
        messagebox.showinfo("Success", f"Layers exported successfully!\n\nLocation:\n{output_dir}")

    except Exception as e:
        print("Error:", e)
        messagebox.showerror("Error", f"Something went wrong:\n\n{e}")


if __name__ == "__main__":
    main()