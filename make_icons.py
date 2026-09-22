"""Draws the app icon: a terracotta vase on cream. Run once: python make_icons.py"""
from PIL import Image, ImageDraw

def icon(size):
    s = size * 4  # draw big, shrink for smooth edges
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, s, s), radius=s * 0.22, fill=(246, 241, 234))
    cx = s / 2
    clay = (181, 85, 47)
    d.ellipse((cx - s * 0.25, s * 0.36, cx + s * 0.25, s * 0.84), fill=clay)          # belly
    d.rectangle((cx - s * 0.10, s * 0.22, cx + s * 0.10, s * 0.50), fill=clay)         # neck
    d.rounded_rectangle((cx - s * 0.15, s * 0.17, cx + s * 0.15, s * 0.25), radius=s * 0.03, fill=clay)  # lip
    d.rectangle((cx - s * 0.25, s * 0.56, cx + s * 0.25, s * 0.61), fill=(79, 138, 144))  # glaze band
    d.rounded_rectangle((cx - s * 0.14, s * 0.80, cx + s * 0.14, s * 0.86), radius=s * 0.02, fill=clay)  # foot
    return im.resize((size, size), Image.LANCZOS)

for n in (180, 192, 512):
    icon(n).save(f"icons/icon-{n}.png")
print("icons written")
