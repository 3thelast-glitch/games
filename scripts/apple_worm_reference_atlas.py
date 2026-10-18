#!/usr/bin/env python3
"""Export a reproducible, labelled 105-stage visual atlas from the user's local MP4.

Evidence only: captured video frames are NOT untouched starts and NOT playable maps.
Source media stays local. Requires: pip install opencv-python Pillow
Usage: python scripts/apple_worm_reference_atlas.py /path/to/walkthrough.mp4 --output ./appleworm-reference
"""
from __future__ import annotations

import argparse
import csv
import math
import re
from pathlib import Path

try:
    import cv2
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:
    raise SystemExit("Install local extraction dependencies: pip install opencv-python Pillow") from exc


def read_times(ts_file: Path) -> list[float]:
    source = ts_file.read_text(encoding="utf-8")
    pattern = r"export const APPLE_WORM_VIDEO_FIRST_OBSERVED_TIMES\s*=\s*\[([^\]]+)\]"
    matched = re.search(pattern, source, re.MULTILINE)
    if not matched:
        raise ValueError("Cannot find first-observed times in reference-video.ts")
    values = [float(item) for item in re.findall(r"\d+(?:\.\d+)?", matched.group(1))]
    if len(values) != 105 or values[0] != 0 or any(a >= b for a, b in zip(values, values[1:])):
        raise ValueError(f"Expected 105 ordered stage observations, got {len(values)}")
    return values


def export(video_file: Path, target: Path, ts_file: Path) -> None:
    values = read_times(ts_file)
    capture = cv2.VideoCapture(str(video_file))
    if not capture.isOpened():
        raise ValueError(f"Cannot open video: {video_file}")
    duration = capture.get(cv2.CAP_PROP_FRAME_COUNT) / capture.get(cv2.CAP_PROP_FPS)
    if duration < 2815:
        raise ValueError(f"Video is too short for the indexed 105 stages: {duration:.1f}s")
    (target / "frames").mkdir(parents=True, exist_ok=True)
    (target / "sheets").mkdir(parents=True, exist_ok=True)
    manifest = []
    stills = []
    font = ImageFont.load_default()
    try:
        for i, first in enumerate(values):
            next_start = values[i + 1] if i + 1 < len(values) else duration
            # A stable representative frame, NOT guaranteed to be the level's start.
            seconds = 0.0 if i == 0 else first + min(2.5, (next_start - first) * 0.28)
            capture.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
            ok, frame = capture.read()
            if not ok:
                raise RuntimeError(f"Could not read frame for level {i + 1} at {seconds:.2f}s")
            name = f"stage_{i + 1:03}.jpg"
            out_file = target / "frames" / name
            cv2.imwrite(str(out_file), frame, [cv2.IMWRITE_JPEG_QUALITY, 93])
            scaled = cv2.resize(frame, (320, 180), interpolation=cv2.INTER_AREA)
            stills.append((i + 1, seconds, Image.fromarray(cv2.cvtColor(scaled, cv2.COLOR_BGR2RGB))))
            manifest.append({
                "stage": i + 1,
                "first_observed_seconds": first,
                "captured_frame_seconds": round(seconds, 3),
                "image": str(Path("frames") / name),
                "is_untouched_start": False,
                "map_verified": False,
                "mechanics_verified": False,
                "solution_verified": False,
            })
        for page_no in range(math.ceil(len(stills) / 10)):
            canvas = Image.new("RGB", (1600, 422), (20, 23, 30))
            pen = ImageDraw.Draw(canvas)
            batch = stills[page_no * 10 : (page_no + 1) * 10]
            for idx, (stage, seconds, img) in enumerate(batch):
                x, y = (idx % 5) * 320, (idx // 5) * 211
                canvas.paste(img, (x, y + 30))
                pen.text((x + 8, y + 6), f"Stage {stage:03d}, {seconds:.2f}s", font=font, fill="white")
            canvas.save(target / "sheets" / f"sheet_{page_no + 1:02}.jpg", quality=93)
        with (target / "manifest.csv").open("w", encoding="utf-8", newline="") as fp:
            writer = csv.DictWriter(fp, fieldnames=list(manifest[0].keys()))
            writer.writeheader()
            writer.writerows(manifest)
        (target / "README.txt").write_text(
            "105 video-sourced reference frames and 11 contact sheets.\n"
            "Captured frames can contain partially moved puzzles, overlays or victory states.\n"
            "These screenshots are NOT playable maps or verified untouched level starts.\n"
            "Transcribe and test the actual initial state and physics from the supplied MP4.\n"
            "Original source media is intentionally not included.\n",
            encoding="utf-8",
        )
        print(f"Exported {len(stills)} stage frames and 11 sheets to {target}")
    finally:
        capture.release()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path, help="Local MP4 supplied by the user")
    parser.add_argument("--output", type=Path, default=Path("appleworm-reference"))
    parser.add_argument(
        "--index",
        type=Path,
        default=Path("packages/games/apple-worm/reference-video.ts"),
    )
    args = parser.parse_args()
    export(args.video, args.output, args.index)
