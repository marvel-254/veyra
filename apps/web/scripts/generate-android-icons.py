"""Generate Android adaptive-icon foreground layers for Veyra.

Android adaptive icons (API 26+) only guarantee the CENTER ~66% of the
foreground layer is visible; launchers mask the rest into arbitrary shapes
(circle, squircle, rounded square). Veyra's full-bleed icon PNGs have the
"V" arms running to the canvas corners, so using them directly as the
foreground gets the arms cropped away.

This script:
  1. loads the master 512px icon,
  2. knocks out the near-black (#0A0A0B) backdrop to transparent,
  3. crops to the visible mark,
  4. rescales it to 58% of the canvas (inside the 66% safe zone),
  5. writes one padded, transparent foreground PNG per density bucket.

The `ic_launcher_background` colour resource supplies the dark fill, so the
final icon is: dark tile + centered V mark.
"""

from PIL import Image

CANVAS = 512
SCALE = 0.58  # fit inside Android's ~66% adaptive safe zone

# Density bucket -> adaptive foreground size (108dp at 1x scale).
DENSITIES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}


def knock_out_backdrop(image: Image.Image, threshold: int = 40) -> Image.Image:
    """Return a copy where near-black pixels become fully transparent."""
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    src = image.load()
    dst = out.load()
    for y in range(image.size[1]):
        for x in range(image.size[0]):
            r, g, b, a = src[x, y]
            if r < threshold and g < threshold and b < threshold:
                dst[x, y] = (r, g, b, 0)
            else:
                dst[x, y] = (r, g, b, a)
    return out


def build_foreground(master_path: str) -> Image.Image:
    master = Image.open(master_path).convert("RGBA")
    mark = knock_out_backdrop(master)

    bbox = mark.getbbox()
    if bbox is None:
        raise SystemExit(f"no visible mark found in {master_path}")
    mark = mark.crop(bbox)

    ratio = SCALE * CANVAS / max(mark.size)
    resized = (
        max(1, int(mark.size[0] * ratio)),
        max(1, int(mark.size[1] * ratio)),
    )
    mark = mark.resize(resized, Image.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(mark, ((CANVAS - resized[0]) // 2, (CANVAS - resized[1]) // 2), mark)
    return canvas


def main() -> None:
    master_path = "public/icons/icon-512.png"
    res_root = "android/app/src/main/res"

    foreground = build_foreground(master_path)
    print(f"foreground canvas: {foreground.size}")

    for bucket, size in DENSITIES.items():
        target = f"{res_root}/mipmap-{bucket}/ic_launcher_foreground.png"
        foreground.resize((size, size), Image.LANCZOS).save(target, "PNG")
        print(f"  wrote {target} ({size}x{size})")

    check = Image.open(f"{res_root}/mipmap-xxxhdpi/ic_launcher_foreground.png")
    print(f"verify xxxhdpi: {check.size} mode={check.mode} alpha_corner={check.getpixel((2, 2))}")


if __name__ == "__main__":
    main()