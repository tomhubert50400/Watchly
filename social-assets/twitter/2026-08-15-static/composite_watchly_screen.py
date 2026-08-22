from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parent
PHOTO_PATH = ROOT / "watchly-cinema-blank.png"
SCREEN_PATH = ROOT.parent / "2026-08-15-video" / "ios26-home.png"
OUTPUT_PATH = ROOT / "watchly-cinema-presentation.png"


def homography(source: np.ndarray, destination: np.ndarray) -> np.ndarray:
    rows = []
    for (source_x, source_y), (destination_x, destination_y) in zip(source, destination):
        rows.append(
            [
                source_x,
                source_y,
                1,
                0,
                0,
                0,
                -destination_x * source_x,
                -destination_x * source_y,
                -destination_x,
            ]
        )
        rows.append(
            [
                0,
                0,
                0,
                source_x,
                source_y,
                1,
                -destination_y * source_x,
                -destination_y * source_y,
                -destination_y,
            ]
        )

    _, _, vectors = np.linalg.svd(np.asarray(rows, dtype=np.float64))
    matrix = vectors[-1].reshape(3, 3)
    return matrix / matrix[2, 2]


photo = Image.open(PHOTO_PATH).convert("RGB")
screen = Image.open(SCREEN_PATH).convert("RGB")
screen = ImageEnhance.Brightness(screen).enhance(1.02)
screen = ImageEnhance.Contrast(screen).enhance(1.0)

screen_width, screen_height = screen.size
photo_width, photo_height = photo.size

screen_pixels = np.asarray(screen).astype(np.float32)
source_y, source_x = np.ogrid[:screen_height, :screen_width]
edge_distance = np.minimum.reduce(
    [
        np.broadcast_to(source_x, (screen_height, screen_width)),
        np.broadcast_to(source_y, (screen_height, screen_width)),
        np.broadcast_to(screen_width - 1 - source_x, (screen_height, screen_width)),
        np.broadcast_to(screen_height - 1 - source_y, (screen_height, screen_width)),
    ]
)
edge_absorption = np.clip((58 - edge_distance) / 58, 0, 1)[..., None] * 0.22
screen = Image.fromarray((screen_pixels * (1 - edge_absorption)).clip(0, 255).astype(np.uint8))

source_points = np.asarray(
    [
        [0, 0],
        [screen_width - 1, 0],
        [screen_width - 1, screen_height - 1],
        [0, screen_height - 1],
    ],
    dtype=np.float64,
)
destination_points = np.asarray(
    [
        [995, 168],
        [1244, 145],
        [1182, 799],
        [895, 777],
    ],
    dtype=np.float64,
)

supersample = 4
high_resolution_destination = destination_points * supersample
source_to_destination = homography(source_points, high_resolution_destination)
destination_to_source = np.linalg.inv(source_to_destination)
destination_to_source /= destination_to_source[2, 2]
coefficients = tuple(destination_to_source.flatten()[:8])

warped_screen_high_resolution = screen.transform(
    (photo_width * supersample, photo_height * supersample),
    Image.Transform.PERSPECTIVE,
    coefficients,
    resample=Image.Resampling.BICUBIC,
)
warped_screen = warped_screen_high_resolution.resize(
    (photo_width, photo_height),
    Image.Resampling.LANCZOS,
)

source_mask = Image.new("L", screen.size, 0)
rounded_mask = Image.new("L", screen.size, 0)
from PIL import ImageDraw

ImageDraw.Draw(rounded_mask).rounded_rectangle(
    (0, 0, screen_width - 1, screen_height - 1),
    radius=118,
    fill=255,
)
source_mask.paste(rounded_mask)
warped_mask_high_resolution = source_mask.transform(
    (photo_width * supersample, photo_height * supersample),
    Image.Transform.PERSPECTIVE,
    coefficients,
    resample=Image.Resampling.BICUBIC,
).filter(ImageFilter.GaussianBlur(1.8))
warped_mask = warped_mask_high_resolution.resize(
    (photo_width, photo_height),
    Image.Resampling.LANCZOS,
)

screen_with_glass = Image.blend(warped_screen, photo, 0.05)
result = photo.copy()
result.paste(screen_with_glass, (0, 0), warped_mask)
result.save(OUTPUT_PATH, quality=96)

print(OUTPUT_PATH)
