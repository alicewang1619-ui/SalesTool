#!/usr/bin/env python3
"""生成文件解析测试夹具：sample.pdf / sample.docx / sample.md / corrupt.pdf。
PDF 用 ASCII 文本（确保 pdfjs 可抽取）；docx 用 zipfile 拼装合法 OOXML（中文）。"""
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))


def make_pdf(path: str) -> None:
    # 依赖 fpdf2（pip install fpdf2）生成保证可被 pdfjs/unpdf 抽取的有效 PDF。
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=16)
    pdf.cell(0, 10, "Cache penetration PDF sample text for extraction.")
    pdf.output(path)


def make_docx(path: str) -> None:
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>"
        '<w:p><w:r><w:t>Word 文档解析测试：分布式锁与缓存雪崩。</w:t></w:r></w:p>'
        '<w:p><w:r><w:t>第二段：布隆过滤器可降低穿透风险。</w:t></w:r></w:p>'
        "</w:body></w:document>"
    )
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document)


def make_md(path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write("# Markdown 测试\n\n这是一段 Markdown 心得，讲缓存击穿。\n\n- 要点一\n- 要点二\n")


def make_corrupt(path: str) -> None:
    with open(path, "wb") as f:
        f.write(b"%PDF-1.4\n this is not a real pdf body \x00\x01 broken")


if __name__ == "__main__":
    make_pdf(os.path.join(HERE, "sample.pdf"))
    make_docx(os.path.join(HERE, "sample.docx"))
    make_md(os.path.join(HERE, "sample.md"))
    make_corrupt(os.path.join(HERE, "corrupt.pdf"))
    print("fixtures written to", HERE)
