from __future__ import annotations

from pathlib import Path
import random

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parents[2]
WIDTH = 1600
HEIGHT = 900

HOME_SCREEN = ROOT / "simulator-current.png"
EXPLORE_SCREEN = ROOT / "simulator-explore.png"
WORDMARK = PROJECT_ROOT / "apps" / "mobile" / "assets" / "watchly-wordmark-ui.png"
LIBRE_BODONI = ROOT / "fonts" / "LibreBodoni.ttf"
PUBLIC_SANS = ROOT / "fonts" / "PublicSans.ttf"

INK = (248, 247, 250, 255)
MUTED = (198, 199, 211, 255)
PINK = (244, 53, 102, 255)
PALE_PINK = (255, 181, 201, 255)
PANEL = (12, 14, 23, 220)


def font(path: Path, size: int, weight: int = 400) -> ImageFont.FreeTypeFont:
    face = ImageFont.truetype(str(path), size=size)
    try:
        face.set_variation_by_axes([weight])
    except (AttributeError, OSError, ValueError):
        pass
    return face


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(image.convert("RGB"), size, method=Image.Resampling.LANCZOS)


def vertical_gradient(size: tuple[int, int], stops: list[tuple[float, tuple[int, int, int, int]]]) -> Image.Image:
    width, height = size
    gradient = Image.new("RGBA", size)
    pixels = gradient.load()
    for y in range(height):
        progress = y / max(height - 1, 1)
        lower = stops[0]
        upper = stops[-1]
        for index in range(len(stops) - 1):
            if stops[index][0] <= progress <= stops[index + 1][0]:
                lower = stops[index]
                upper = stops[index + 1]
                break
        span = max(upper[0] - lower[0], 0.0001)
        local = (progress - lower[0]) / span
        color = tuple(round(lower[1][channel] + (upper[1][channel] - lower[1][channel]) * local) for channel in range(4))
        for x in range(width):
            pixels[x, y] = color
    return gradient


def radial_glow(size: tuple[int, int], center: tuple[int, int], radius: int, color: tuple[int, int, int], strength: int) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    glow = Image.new("L", (radius * 2, radius * 2))
    glow_pixels = glow.load()
    for y in range(radius * 2):
        for x in range(radius * 2):
            distance = ((x - radius) ** 2 + (y - radius) ** 2) ** 0.5 / radius
            glow_pixels[x, y] = round(max(0.0, 1.0 - distance) ** 2 * strength)
    tint = Image.new("RGBA", glow.size, (*color, 0))
    tint.putalpha(glow)
    layer.alpha_composite(tint, (center[0] - radius, center[1] - radius))
    return layer


def atmospheric_background(screen_path: Path, focus: tuple[float, float], tint: tuple[int, int, int]) -> Image.Image:
    source = Image.open(screen_path).convert("RGB")
    source_ratio = source.width / source.height
    target_ratio = WIDTH / HEIGHT
    if source_ratio < target_ratio:
        crop_height = round(source.width / target_ratio)
        focus_y = round((source.height - crop_height) * focus[1])
        focus_y = max(0, min(focus_y, source.height - crop_height))
        source = source.crop((0, focus_y, source.width, focus_y + crop_height))
    else:
        crop_width = round(source.height * target_ratio)
        focus_x = round((source.width - crop_width) * focus[0])
        focus_x = max(0, min(focus_x, source.width - crop_width))
        source = source.crop((focus_x, 0, focus_x + crop_width, source.height))

    background = source.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(62))
    background = ImageEnhance.Color(background).enhance(1.35)
    background = ImageEnhance.Contrast(background).enhance(1.12).convert("RGBA")
    background.alpha_composite(Image.new("RGBA", background.size, (*tint, 74)))
    background.alpha_composite(vertical_gradient(
        background.size,
        [
            (0.0, (5, 7, 13, 110)),
            (0.55, (7, 8, 16, 155)),
            (1.0, (5, 6, 12, 225)),
        ],
    ))

    noise = Image.effect_noise(background.size, 13).convert("L")
    noise_layer = Image.new("RGBA", background.size, (255, 255, 255, 0))
    noise_layer.putalpha(noise.point(lambda value: max(0, min(20, value // 9))))
    return Image.alpha_composite(background, noise_layer)


def rounded_image(image: Image.Image, size: tuple[int, int], radius: int) -> Image.Image:
    fitted = cover(image, size).convert("RGBA")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    fitted.putalpha(mask)
    return fitted


def phone_mockup(screen_path: Path, width: int, angle: float) -> Image.Image:
    screen = Image.open(screen_path).convert("RGBA")
    height = round(width * screen.height / screen.width)
    frame = 11
    radius = round(width * 0.092)
    outer = Image.new("RGBA", (width + frame * 2, height + frame * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(outer)
    draw.rounded_rectangle(
        (0, 0, outer.width - 1, outer.height - 1),
        radius=radius + frame,
        fill=(8, 10, 16, 255),
        outline=(79, 84, 103, 255),
        width=3,
    )
    outer.alpha_composite(rounded_image(screen, (width, height), radius), (frame, frame))

    shadow = Image.new("RGBA", (outer.width + 90, outer.height + 90), (0, 0, 0, 0))
    shadow_mask = Image.new("L", outer.size, 0)
    ImageDraw.Draw(shadow_mask).rounded_rectangle((0, 0, outer.width - 1, outer.height - 1), radius=radius + frame, fill=215)
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(28))
    shadow_color = Image.new("RGBA", outer.size, (0, 0, 0, 0))
    shadow_color.putalpha(shadow_mask)
    shadow.alpha_composite(shadow_color, (48, 48))
    shadow.alpha_composite(outer, (16, 10))
    return shadow.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)


def paste_scaled(canvas: Image.Image, image_path: Path, box: tuple[int, int, int, int]) -> None:
    image = Image.open(image_path).convert("RGBA")
    image.thumbnail((box[2], box[3]), Image.Resampling.LANCZOS)
    canvas.alpha_composite(image, (box[0], box[1]))


def draw_tracking(draw: ImageDraw.ImageDraw, position: tuple[int, int], text: str, text_font: ImageFont.FreeTypeFont, fill: tuple[int, int, int, int], tracking: int) -> None:
    x, y = position
    for character in text:
        draw.text((x, y), character, font=text_font, fill=fill)
        x += round(draw.textlength(character, font=text_font)) + tracking


def draw_pill(draw: ImageDraw.ImageDraw, xy: tuple[int, int], label: str) -> None:
    label_font = font(PUBLIC_SANS, 17, 650)
    text_width = round(draw.textlength(label, font=label_font))
    x, y = xy
    draw.rounded_rectangle((x, y, x + text_width + 34, y + 42), radius=21, fill=(22, 24, 33, 255), outline=(121, 53, 75, 255), width=1)
    draw.text((x + 17, y + 10), label, font=label_font, fill=(255, 181, 201, 255))


def render_intro() -> Path:
    canvas = atmospheric_background(HOME_SCREEN, (0.5, 0.06), (72, 4, 24))
    canvas.alpha_composite(radial_glow(canvas.size, (1260, 220), 520, (232, 27, 78), 90))
    canvas.alpha_composite(radial_glow(canvas.size, (1500, 720), 560, (28, 106, 130), 75))
    draw = ImageDraw.Draw(canvas)

    paste_scaled(canvas, WORDMARK, (84, 60, 226, 86))
    kicker_font = font(PUBLIC_SANS, 20, 700)
    draw_tracking(draw, (88, 190), "BUILDING IN PUBLIC  /  01", kicker_font, PALE_PINK, 3)

    headline_font = font(LIBRE_BODONI, 92, 600)
    draw.multiline_text((82, 238), "Your watch life,\nwith atmosphere.", font=headline_font, fill=INK, spacing=-6)
    draw.rounded_rectangle((86, 474, 176, 480), radius=3, fill=PINK)

    body_font = font(PUBLIC_SANS, 28, 450)
    draw.multiline_text(
        (84, 516),
        "Discover films and series in an interface\nthat changes with what’s on screen.",
        font=body_font,
        fill=MUTED,
        spacing=13,
    )
    draw.text((84, 680), "WATCHLY  /  PRE-LAUNCH", font=font(PUBLIC_SANS, 18, 700), fill=(244, 53, 102, 235))

    explore_phone = phone_mockup(EXPLORE_SCREEN, 318, -4.5)
    home_phone = phone_mockup(HOME_SCREEN, 338, 5.5)
    canvas.alpha_composite(explore_phone, (898, 116))
    canvas.alpha_composite(home_phone, (1165, 58))

    output = ROOT / "01-meet-watchly-current.png"
    canvas.convert("RGB").save(output, format="PNG", optimize=True)
    return output


def render_discovery() -> Path:
    canvas = atmospheric_background(EXPLORE_SCREEN, (0.5, 0.28), (16, 28, 20))
    canvas.alpha_composite(vertical_gradient(
        canvas.size,
        [
            (0.0, (7, 8, 14, 120)),
            (0.4, (7, 8, 14, 80)),
            (1.0, (7, 8, 14, 210)),
        ],
    ))
    canvas.alpha_composite(radial_glow(canvas.size, (260, 580), 560, (230, 37, 88), 85))
    draw = ImageDraw.Draw(canvas)

    phone = phone_mockup(EXPLORE_SCREEN, 386, -2.5)
    canvas.alpha_composite(phone, (84, 18))

    paste_scaled(canvas, WORDMARK, (1184, 58, 246, 92))
    kicker_font = font(PUBLIC_SANS, 20, 700)
    draw_tracking(draw, (704, 170), "DISCOVER WHAT'S NEXT", kicker_font, PALE_PINK, 3)

    headline_font = font(LIBRE_BODONI, 90, 600)
    draw.multiline_text((696, 221), "Less database.\nMore discovery.", font=headline_font, fill=INK, spacing=-4)
    draw.rounded_rectangle((700, 459, 790, 465), radius=3, fill=PINK)

    body_font = font(PUBLIC_SANS, 27, 450)
    draw.multiline_text(
        (698, 505),
        "Trending titles, coming soon, movies,\nseries and people, in one cinematic search.",
        font=body_font,
        fill=MUTED,
        spacing=12,
    )

    draw_pill(draw, (698, 652), "TRENDING")
    draw_pill(draw, (858, 652), "COMING SOON")
    draw_pill(draw, (1071, 652), "PEOPLE")
    draw.text((699, 746), "WATCHLY  /  PRE-LAUNCH", font=font(PUBLIC_SANS, 18, 700), fill=(244, 53, 102, 235))

    output = ROOT / "02-discover-current.png"
    canvas.convert("RGB").save(output, format="PNG", optimize=True)
    return output


def main() -> None:
    required = [HOME_SCREEN, EXPLORE_SCREEN, WORDMARK, LIBRE_BODONI, PUBLIC_SANS]
    missing = [path for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing render inputs: " + ", ".join(str(path) for path in missing))

    random.seed(15)
    for output in (render_intro(), render_discovery()):
        print(output)


if __name__ == "__main__":
    main()
