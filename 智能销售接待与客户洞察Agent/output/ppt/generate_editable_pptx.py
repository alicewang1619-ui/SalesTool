from __future__ import annotations

import html
import re
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape


PPT_DIR = Path(__file__).resolve().parent
PPTX_PATH = PPT_DIR / "ultrasound-sales-agent-report.pptx"
ASSET_DIR = PPT_DIR / "assets"
EMU_PER_INCH = 914400
SLIDE_W = int(13.333333 * EMU_PER_INCH)
SLIDE_H = int(7.5 * EMU_PER_INCH)

INK = "162033"
MUTED = "607089"
LINE = "D7DFEB"
PANEL = "FFFFFF"
BG = "F6F8FB"
ACCENT = "0F7B8F"
ACCENT_2 = "224E7A"
WARN = "B45F2A"
GOOD = "2F7D5B"
FONT = "Microsoft YaHei"
VISUAL_FILES = {
    "hero": "hero-ultrasound-growth.png",
    "inquiry": "inquiry-funnel.png",
    "architecture": "agent-architecture.png",
}


def emu(value: float) -> int:
    return int(round(value * EMU_PER_INCH))


def clean(fragment: str) -> str:
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    fragment = html.unescape(fragment)
    return re.sub(r"\s+", " ", fragment).strip()


def first(pattern: str, source: str) -> str:
    match = re.search(pattern, source, re.S)
    return clean(match.group(1)) if match else ""


def all_clean(pattern: str, source: str) -> list[str]:
    return [clean(match) for match in re.findall(pattern, source, re.S) if clean(match)]


def tag_blocks(tag: str, class_name: str, source: str) -> list[str]:
    pattern = rf'<{tag}[^>]*class="{re.escape(class_name)}"[^>]*>(.*?)</{tag}>'
    return re.findall(pattern, source, re.S)


def parse_card(fragment: str) -> dict[str, str]:
    paragraphs = all_clean(r"<p[^>]*>(.*?)</p>", fragment)
    return {
        "metric": first(r'<div class="metric">(.*?)</div>', fragment),
        "label": first(r'<div class="label">(.*?)</div>', fragment),
        "title": first(r"<h3[^>]*>(.*?)</h3>", fragment),
        "text": " ".join(paragraphs),
    }


def parse_step(fragment: str) -> dict[str, str]:
    return {
        "title": first(r"<b[^>]*>(.*?)</b>", fragment),
        "text": first(r"<span[^>]*>(.*?)</span>", fragment),
    }


def parse_table(source: str) -> tuple[list[str], list[list[str]]]:
    table = re.search(r"<table[^>]*>(.*?)</table>", source, re.S)
    if not table:
        return [], []
    table_html = table.group(1)
    headers = all_clean(r"<th[^>]*>(.*?)</th>", table_html)
    rows: list[list[str]] = []
    for row_html in re.findall(r"<tr[^>]*>(.*?)</tr>", table_html, re.S):
        cells = all_clean(r"<td[^>]*>(.*?)</td>", row_html)
        if cells:
            rows.append(cells)
    return headers, rows


def parse_slide(path: Path) -> dict:
    source = path.read_text(encoding="utf-8")
    source_no_nav = re.sub(r"<nav\b.*?</nav>", "", source, flags=re.S)
    cards = [parse_card(block) for block in tag_blocks("section", "card", source_no_nav)]
    phases = [parse_card(block) for block in tag_blocks("section", "phase", source_no_nav)]
    steps = [parse_step(block) for block in tag_blocks("div", "step", source_no_nav)]
    headers, rows = parse_table(source_no_nav)
    return {
        "slide_no": first(r'<div class="slide-no">(.*?)</div>', source_no_nav),
        "eyebrow": first(r'<span class="eyebrow">(.*?)</span>', source_no_nav),
        "title": first(r"<h1[^>]*>(.*?)</h1>", source_no_nav)
        or first(r"<h2[^>]*>(.*?)</h2>", source_no_nav),
        "subtitles": all_clean(r'<p class="subtitle">(.*?)</p>', source_no_nav),
        "tags": all_clean(r'<span class="tag">(.*?)</span>', source_no_nav),
        "cards": cards,
        "phases": phases,
        "steps": steps,
        "table_headers": headers,
        "table_rows": rows,
        "paragraphs": all_clean(r"<p[^>]*>(.*?)</p>", source_no_nav),
        "bars_note": first(r'<div class="bars">.*?<p class="small">(.*?)</p>.*?</div>', source_no_nav),
        "has_split": 'class="split"' in source_no_nav,
        "visual": first(r'<main class="stage" data-visual="([^"]+)"', source),
        "page": int(re.search(r"p(\d+)\.html$", path.name).group(1)),
    }


class SlideBuilder:
    def __init__(self, image_rel: str | None = None) -> None:
        self.next_id = 2
        self.parts: list[str] = []
        self.image_rel = image_rel

    def ident(self) -> int:
        value = self.next_id
        self.next_id += 1
        return value

    def rect(
        self,
        name: str,
        x: float,
        y: float,
        w: float,
        h: float,
        fill: str = PANEL,
        line: str | None = LINE,
        rounded: bool = False,
        alpha: int | None = None,
    ) -> None:
        shape_id = self.ident()
        if fill:
            alpha_xml = f'<a:alpha val="{alpha}"/>' if alpha is not None else ""
            fill_xml = f'<a:solidFill><a:srgbClr val="{fill}">{alpha_xml}</a:srgbClr></a:solidFill>'
        else:
            fill_xml = "<a:noFill/>"
        line_xml = (
            f'<a:ln w="9525"><a:solidFill><a:srgbClr val="{line}"/></a:solidFill></a:ln>'
            if line
            else "<a:ln><a:noFill/></a:ln>"
        )
        geom = "roundRect" if rounded else "rect"
        self.parts.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{shape_id}" name="{xml_escape(name)}"/>'
            f"<p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>"
            f'<a:xfrm><a:off x="{emu(x)}" y="{emu(y)}"/><a:ext cx="{emu(w)}" cy="{emu(h)}"/></a:xfrm>'
            f'<a:prstGeom prst="{geom}"><a:avLst/></a:prstGeom>{fill_xml}{line_xml}'
            f"</p:spPr></p:sp>"
        )

    def picture(self, name: str, rel_id: str, x: float, y: float, w: float, h: float) -> None:
        shape_id = self.ident()
        self.parts.append(
            f'<p:pic><p:nvPicPr><p:cNvPr id="{shape_id}" name="{xml_escape(name)}"/>'
            f"<p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill>"
            f'<a:blip r:embed="{rel_id}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
            f"<p:spPr>"
            f'<a:xfrm><a:off x="{emu(x)}" y="{emu(y)}"/><a:ext cx="{emu(w)}" cy="{emu(h)}"/></a:xfrm>'
            f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
            f"</p:spPr></p:pic>"
        )

    def text(
        self,
        name: str,
        value: str,
        x: float,
        y: float,
        w: float,
        h: float,
        size: float,
        color: str = INK,
        bold: bool = False,
        align: str = "l",
        fill: str | None = None,
        line: str | None = None,
        rounded: bool = False,
    ) -> None:
        shape_id = self.ident()
        value = value or ""
        lines = [line.strip() for line in value.split("\n") if line.strip()] or [""]
        bold_attr = ' b="1"' if bold else ""
        fill_xml = f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>' if fill else "<a:noFill/>"
        line_xml = (
            f'<a:ln w="9525"><a:solidFill><a:srgbClr val="{line}"/></a:solidFill></a:ln>'
            if line
            else "<a:ln><a:noFill/></a:ln>"
        )
        geom = "roundRect" if rounded else "rect"
        para_xml = []
        for line_text in lines:
            para_xml.append(
                f'<a:p><a:pPr algn="{align}"/><a:r><a:rPr lang="zh-CN" sz="{int(size * 100)}"{bold_attr} dirty="0">'
                f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill>'
                f'<a:latin typeface="{FONT}"/><a:ea typeface="{FONT}"/><a:cs typeface="Arial"/>'
                f"</a:rPr><a:t>{xml_escape(line_text)}</a:t></a:r>"
                f'<a:endParaRPr lang="zh-CN" sz="{int(size * 100)}"/></a:p>'
            )
        self.parts.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{shape_id}" name="{xml_escape(name)}"/>'
            f'<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>'
            f'<a:xfrm><a:off x="{emu(x)}" y="{emu(y)}"/><a:ext cx="{emu(w)}" cy="{emu(h)}"/></a:xfrm>'
            f'<a:prstGeom prst="{geom}"><a:avLst/></a:prstGeom>{fill_xml}{line_xml}</p:spPr>'
            f'<p:txBody><a:bodyPr wrap="square" lIns="54864" tIns="36576" rIns="54864" bIns="36576">'
            f"<a:normAutofit/></a:bodyPr><a:lstStyle/>{''.join(para_xml)}</p:txBody></p:sp>"
        )

    def xml(self) -> str:
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
            'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            "<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/>"
            "<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr>"
            '<a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
            '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>'
            f"</p:grpSpPr>{''.join(self.parts)}</p:spTree></p:cSld>"
            '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
        )


def header(slide: SlideBuilder, data: dict, hero: bool = False) -> None:
    if slide.image_rel:
        slide.picture("Visual Background", slide.image_rel, 0, 0, 13.333333, 7.5)
        slide.rect("Photo Wash", 0, 0, 13.333333, 7.5, BG, None, alpha=68000)
        slide.rect("Content Wash", 0, 0, 7.65 if hero else 13.333333, 7.5, BG, None, alpha=88000 if hero else 76000)
    else:
        slide.rect("Background", 0, 0, 13.333333, 7.5, BG, None)
    slide.rect("Top Accent", 0, 0, 13.333333, 0.08, ACCENT, None)
    slide.text("Slide Number", data["slide_no"], 11.5, 0.22, 1.0, 0.3, 11, MUTED, align="r")
    slide.text("Eyebrow", data["eyebrow"], 0.72, 0.40, 5.4, 0.35, 13, ACCENT, bold=True)
    if not hero:
        slide.text("Title", data["title"], 0.72, 0.78, 11.7, 0.78, 30, INK, bold=True)


def add_card(slide: SlideBuilder, card: dict[str, str], x: float, y: float, w: float, h: float, accent: str = ACCENT) -> None:
    slide.rect("Card", x, y, w, h, PANEL, LINE, rounded=True)
    slide.rect("Card Accent", x, y, 0.05, h, accent, None)
    cursor = y + 0.18
    if card.get("metric"):
        slide.text("Metric", card["metric"], x + 0.18, cursor, w - 0.36, 0.55, 28, ACCENT_2, bold=True)
        cursor += 0.58
    if card.get("label"):
        slide.text("Label", card["label"], x + 0.18, cursor, w - 0.36, 0.28, 10.5, ACCENT, bold=True)
        cursor += 0.32
    if card.get("title"):
        slide.text("Card Title", card["title"], x + 0.18, cursor, w - 0.36, 0.42, 14.5, INK, bold=True)
        cursor += 0.45
    if card.get("text"):
        slide.text("Card Body", card["text"], x + 0.18, cursor, w - 0.36, max(0.45, y + h - cursor - 0.12), 10.8, MUTED)


def add_grid(slide: SlideBuilder, data: dict) -> None:
    cards = data["cards"]
    count = len(cards)
    cols = count if count in (2, 3, 4) else min(3, max(1, count))
    gap = 0.28
    left = 0.72
    total_w = 11.9
    card_w = (total_w - gap * (cols - 1)) / cols
    card_h = 1.65 if count == 4 else 2.05
    y = 2.05
    for i, card in enumerate(cards):
        row = i // cols
        col = i % cols
        add_card(slide, card, left + col * (card_w + gap), y + row * (card_h + 0.28), card_w, card_h)
    if data.get("bars_note"):
        bar_y = y + card_h + 0.55
        slide.rect("Feedback Bar Background", left, bar_y, 8.8, 0.25, "E7EDF4", None, rounded=True)
        slide.rect("Feedback Bar", left, bar_y, 4.4, 0.25, ACCENT, None, rounded=True)
        slide.text("Feedback Note", data["bars_note"], left, bar_y + 0.34, 9.5, 0.38, 12, MUTED)
    elif data["subtitles"]:
        slide.text("Subtitle", data["subtitles"][-1], left, y + card_h + 0.48, 10.8, 0.6, 19, MUTED)


def add_tags(slide: SlideBuilder, tags: list[str]) -> None:
    if not tags:
        return
    left = 1.35
    gap = 0.35
    tag_w = 1.55
    y = 5.15
    for i, tag in enumerate(tags):
        x = left + i * (tag_w + gap)
        slide.text("Tag", tag, x, y, tag_w, 0.48, 13, ACCENT_2, bold=True, align="ctr", fill=PANEL, line=LINE, rounded=True)


def add_steps(slide: SlideBuilder, data: dict) -> None:
    left = 0.72
    gap = 0.16
    total_w = 11.9
    step_w = (total_w - gap * 5) / 6
    y = 2.45
    for i, step in enumerate(data["steps"]):
        x = left + i * (step_w + gap)
        slide.rect("Step", x, y, step_w, 1.9, PANEL, LINE, rounded=True)
        slide.rect("Step Accent", x, y, step_w, 0.06, ACCENT, None)
        slide.text("Step Title", step["title"], x + 0.12, y + 0.2, step_w - 0.24, 0.35, 13, ACCENT_2, bold=True)
        slide.text("Step Text", step["text"], x + 0.12, y + 0.7, step_w - 0.24, 0.8, 10.2, MUTED)


def add_split(slide: SlideBuilder, data: dict) -> None:
    left_paragraphs = data["paragraphs"][:-1] if data["cards"] else data["paragraphs"]
    if left_paragraphs:
        slide.text("Value Text", left_paragraphs[0], 0.82, 2.05, 5.45, 0.85, 18, MUTED)
    if len(left_paragraphs) > 1:
        slide.text("Value Subtitle", left_paragraphs[1], 0.82, 3.15, 5.65, 1.25, 20, MUTED)
    if data["cards"]:
        add_card(slide, data["cards"][0], 7.0, 2.35, 5.2, 2.25, ACCENT)


def add_table(slide: SlideBuilder, data: dict) -> None:
    headers = data["table_headers"]
    rows = data["table_rows"]
    if not headers:
        return
    left = 0.62
    top = 1.68
    total_w = 12.05
    if len(rows) > 3:
        widths = [2.25, 5.05, 4.75]
        header_h = 0.48
        row_h = 0.67
        font = 9.4
        header_font = 10.4
    else:
        widths = [2.25, 4.45, 5.35]
        header_h = 0.55
        row_h = 1.25
        font = 11.5
        header_font = 12.2
    scale = total_w / sum(widths)
    widths = [w * scale for w in widths]

    def draw_row(values: list[str], y: float, h: float, fill: str, font_size: float, bold: bool = False, color: str = INK) -> None:
        x = left
        for idx, width in enumerate(widths):
            slide.rect("Table Cell", x, y, width, h, fill, LINE)
            text = values[idx] if idx < len(values) else ""
            slide.text("Table Text", text, x + 0.06, y + 0.04, width - 0.12, h - 0.08, font_size, color, bold=bold)
            x += width

    draw_row(headers, top, header_h, "EAF2F7", header_font, True, ACCENT_2)
    current_y = top + header_h
    for row in rows:
        draw_row(row, current_y, row_h, PANEL, font)
        current_y += row_h


def add_phases(slide: SlideBuilder, data: dict) -> None:
    phases = data["phases"]
    left = 0.72
    gap = 0.35
    card_w = (11.9 - gap * 2) / 3
    colors = [ACCENT, WARN, GOOD]
    for i, phase in enumerate(phases):
        x = left + i * (card_w + gap)
        add_card(slide, phase, x, 2.1, card_w, 2.45, colors[i % len(colors)])


def render_slide(data: dict) -> str:
    image_rel = "rId2" if data.get("visual") in VISUAL_FILES else None
    slide = SlideBuilder(image_rel=image_rel)
    is_hero = data["page"] == 1
    header(slide, data, hero=is_hero)
    if is_hero:
        slide.text("Hero Title", data["title"], 1.35, 1.65, 10.8, 0.95, 42, INK, bold=True)
        subtitle = data["subtitles"][0] if data["subtitles"] else ""
        slide.text("Hero Subtitle", subtitle, 1.35, 3.15, 10.9, 0.8, 24, MUTED)
        add_tags(slide, data["tags"])
    elif data["table_headers"]:
        add_table(slide, data)
    elif data["steps"]:
        add_steps(slide, data)
    elif data["phases"]:
        add_phases(slide, data)
    elif data["has_split"]:
        add_split(slide, data)
    elif data["cards"]:
        add_grid(slide, data)
    elif data["subtitles"]:
        slide.text("Subtitle", data["subtitles"][0], 0.72, 2.1, 10.8, 1.0, 20, MUTED)
    return slide.xml()


def slide_key(path: Path) -> int:
    return int(re.search(r"p(\d+)\.html$", path.name).group(1))


def slide_rels(visual: str) -> bytes:
    image_rel = ""
    if visual in VISUAL_FILES:
        image_rel = (
            f'<Relationship Id="rId2" '
            f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
            f'Target="../media/{VISUAL_FILES[visual]}"/>'
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" '
        'Target="../slideLayouts/slideLayout1.xml"/>'
        f"{image_rel}</Relationships>"
    )
    return xml.encode("utf-8")


def content_types_xml(existing: bytes) -> bytes:
    text = existing.decode("utf-8")
    if 'Extension="png"' not in text:
        text = text.replace(
            '<Default Extension="xml" ContentType="application/xml"/>',
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Default Extension="png" ContentType="image/png"/>',
        )
    return text.encode("utf-8")


def regenerate() -> None:
    html_files = sorted(PPT_DIR.glob("p*.html"), key=slide_key)
    if not html_files:
        raise SystemExit("No html slides found.")
    if not PPTX_PATH.exists():
        raise SystemExit("PPTX template is missing.")
    slides = [parse_slide(path) for path in html_files]
    slide_xml = [render_slide(data).encode("utf-8") for data in slides]
    tmp_path = PPTX_PATH.with_suffix(".tmp.pptx")
    slide_pattern = re.compile(r"ppt/slides/slide\d+\.xml$")
    slide_rel_pattern = re.compile(r"ppt/slides/_rels/slide\d+\.xml\.rels$")
    media_pattern = re.compile(r"ppt/media/")
    with zipfile.ZipFile(PPTX_PATH, "r") as src, zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            if item.filename == "[Content_Types].xml":
                dst.writestr(item, content_types_xml(src.read(item.filename)))
                continue
            if slide_pattern.fullmatch(item.filename) or slide_rel_pattern.fullmatch(item.filename) or media_pattern.match(item.filename):
                continue
            dst.writestr(item, src.read(item.filename))
        for idx, xml in enumerate(slide_xml, start=1):
            dst.writestr(f"ppt/slides/slide{idx}.xml", xml)
            dst.writestr(f"ppt/slides/_rels/slide{idx}.xml.rels", slide_rels(slides[idx - 1].get("visual", "")))
        for file_name in sorted({VISUAL_FILES[data["visual"]] for data in slides if data.get("visual") in VISUAL_FILES}):
            asset_path = ASSET_DIR / file_name
            if not asset_path.exists():
                raise SystemExit(f"Missing visual asset: {asset_path}")
            dst.writestr(f"ppt/media/{file_name}", asset_path.read_bytes())
    tmp_path.replace(PPTX_PATH)


if __name__ == "__main__":
    regenerate()
    print(PPTX_PATH)
