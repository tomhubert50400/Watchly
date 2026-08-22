from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parents[2]
WIDTH = 1600
HEIGHT = 900

BACKGROUND = ROOT / "watchly-cinematic-backdrop.png"
HOME = PROJECT_ROOT / "social-assets" / "twitter" / "2026-08-15-video" / "ios26-home.png"
EXPLORE = PROJECT_ROOT / "social-assets" / "twitter" / "2026-08-15-video" / "ios26-explore.png"
DETAIL = ROOT / "watchly-detail-spiderman.jpg"
WORDMARK = PROJECT_ROOT / "apps" / "mobile" / "assets" / "watchly-wordmark-ui.png"
FONT = PROJECT_ROOT / "social-assets" / "twitter" / "2026-08-15" / "fonts" / "PublicSans.ttf"
OUTPUT = ROOT / "watchly-app-screens-tweet.png"


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(image.convert("RGBA"), size, method=Image.Resampling.LANCZOS)


def rounded_screen(image: Image.Image, size: tuple[int, int], radius: int) -> Image.Image:
    screen = image.resize(size, Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    screen.putalpha(mask)
    return screen


def phone(screen_path: Path, width: int, angle: float) -> Image.Image:
    source = Image.open(screen_path).convert("RGBA")
    height = round(width * source.height / source.width)
    frame = 10
    radius = round(width * 0.09)
    device = Image.new("RGBA", (width + frame * 2, height + frame * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(device)
    draw.rounded_rectangle(
        (0, 0, device.width - 1, device.height - 1),
        radius=radius + frame,
        fill=(4, 5, 9, 255),
        outline=(86, 90, 107, 255),
        width=3,
    )
    device.alpha_composite(rounded_screen(source, (width, height), radius), (frame, frame))

    shadow = Image.new("RGBA", (device.width + 100, device.height + 100), (0, 0, 0, 0))
    shadow_mask = Image.new("L", device.size, 0)
    ImageDraw.Draw(shadow_mask).rounded_rectangle(
        (0, 0, device.width - 1, device.height - 1), radius=radius + frame, fill=215
    )
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(28))
    shadow_layer = Image.new("RGBA", device.size, (0, 0, 0, 0))
    shadow_layer.putalpha(shadow_mask)
    shadow.alpha_composite(shadow_layer, (54, 58))
    shadow.alpha_composite(device, (16, 12))
    return shadow.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)


def tracking_text(
    draw: ImageDraw.ImageDraw,
    position: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    spacing: int,
) -> None:
    x, y = position
    for character in text:
        draw.text((x, y), character, font=font, fill=fill)
        x += round(draw.textlength(character, font=font)) + spacing


def main() -> None:
    required = [BACKGROUND, HOME, EXPLORE, DETAIL, WORDMARK, FONT]
    missing = [path for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing render inputs: " + ", ".join(str(path) for path in missing))

    canvas = cover(Image.open(BACKGROUND), (WIDTH, HEIGHT))
    canvas.alpha_composite(Image.new("RGBA", canvas.size, (2, 3, 8, 42)))

    explore_phone = phone(EXPLORE, 300, -7)
    detail_phone = phone(DETAIL, 300, 7)
    home_phone = phone(HOME, 372, 0)
    canvas.alpha_composite(explore_phone, (248, 145))
    canvas.alpha_composite(detail_phone, (1010, 145))
    canvas.alpha_composite(home_phone, (596, 62))

    wordmark = Image.open(WORDMARK).convert("RGBA")
    wordmark.thumbnail((255, 94), Image.Resampling.LANCZOS)
    canvas.alpha_composite(wordmark, (70, 48))

    label_font = ImageFont.truetype(str(FONT), 19)
    draw = ImageDraw.Draw(canvas)
    tracking_text(draw, (1162, 68), "DISCOVER  TRACK  SHARE", label_font, (255, 202, 217, 235), 2)

    canvas.convert("RGB").save(OUTPUT, format="PNG", optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
