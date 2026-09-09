#!/usr/bin/env python3
"""
inventory_submission.py — Inventory Section 02 (DWKZ) submission, reconcile files, and parse TC vetting statuses.

Performs Phase 1 of Section 02 Drainage Design Ingestion:
1. Parses Transmittal sheet #3848.xlsx (bounded to valid rows 10-188).
2. Reconciles all listed documents against the PDF files in 'Doc no. 1084'.
3. Parses Consultant Technical Comment KMD TC 1084 26 HYD 30 085 00 (TC 1084/26) approval statuses and comments.
4. Parses Consultant Technical Comment KMD TC 1153 26 HYD 30 174 00 (TC 1153/26) approval statuses and comments.
5. Notes the superseded status of KMD TC 417 25 HYD 30 046 00 (TC 417/25).
6. Records explicit gap for Symbology drawing T2019-323-DD-KM-DWKZ-2200-DW-03000.
7. Generates data/section02_drawing_register.json.
"""

import os
import sys
import json
import re
from collections import Counter
import openpyxl
import pymupdf

# Configure stdout encoding for Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
WORKSPACE_ROOT = os.path.abspath(os.path.join(APP_DIR, '..'))

DOC_1084_DIR = os.path.join(WORKSPACE_ROOT, 'Doc no. 1084')
TRANSMITTAL_PATH = os.path.join(DOC_1084_DIR, 'Transmittal sheet #3848.xlsx')
TC_1084_PATH = os.path.join(DOC_1084_DIR, 'KMD TC 1084 26 HYD 30 085 00.pdf')
TC_1153_PATH = os.path.join(DOC_1084_DIR, 'KMD TC 1153 26 HYD 30 174 00.pdf')
TC_417_PATH = os.path.join(WORKSPACE_ROOT, 'KMD TC 417 25 HYD 30 046 00.pdf')
OUT_JSON_PATH = os.path.join(APP_DIR, 'data', 'section02_drawing_register.json')


def parse_chainages_from_title(title):
    """
    Extracts start_pk and end_pk in meters from drawing title.
    Returns (start_pk, end_pk, chainage_str).
    """
    # Matches patterns like CH 19+800, CH=19+800, 82+902.439
    matches = re.findall(r'(\d+)\+(\d{3}(?:\.\d+)?)', title)
    if len(matches) == 1:
        km, m = int(matches[0][0]), float(matches[0][1])
        pk = km * 1000.0 + m
        pk_str = f"PK {km:02d}+{int(m):03d}" if m.is_integer() else f"PK {km:02d}+{m:07.3f}"
        return pk, pk, pk_str
    elif len(matches) >= 2:
        km1, m1 = int(matches[0][0]), float(matches[0][1])
        km2, m2 = int(matches[1][0]), float(matches[1][1])
        pk1 = km1 * 1000.0 + m1
        pk2 = km2 * 1000.0 + m2
        pk1_str = f"PK {km1:02d}+{int(m1):03d}" if m1.is_integer() else f"PK {km1:02d}+{m1:07.3f}"
        pk2_str = f"PK {km2:02d}+{int(m2):03d}" if m2.is_integer() else f"PK {km2:02d}+{m2:07.3f}"
        return pk1, pk2, f"{pk1_str} \u2013 {pk2_str}"
    return None, None, None


def categorize_drawing(doc_code, title):
    if 'DW-03' in doc_code:
        return 'Plan Sheet'
    elif 'DW-04' in doc_code:
        return 'Culvert Detail'
    elif 'DW-06' in doc_code:
        return 'Culvert Schedule Table'
    elif 'DW-08' in doc_code:
        return 'Collector Drain'
    elif 'RP-00001' in doc_code:
        return 'Design Report'
    return 'Other'


def parse_tc1084_tables_and_comments():
    doc = pymupdf.open(TC_1084_PATH)
    status_records = {}
    
    # 1. Parse status table (Pages 54 to 69, 0-indexed 53 to 68)
    for pno in range(53, 69):
        page = doc[pno]
        for t in page.find_tables().tables:
            for r in t.extract():
                if r and len(r) >= 4 and r[0] and r[0].strip().isdigit():
                    item_n = int(r[0].strip())
                    doc_raw = r[2].replace('\n', ' ') if r[2] else ''
                    m = re.search(r'(T2019-323-DD-KM-DWKZ-2200-[A-Z]{2}-\d{5}(?:-\d{2})?)', doc_raw)
                    submitted_code = m.group(1) if m else ''
                    
                    # Attached code if marked up
                    attached_code = None
                    if '---' in doc_raw:
                        parts = doc_raw.split('---')
                        if len(parts) > 1:
                            m_att = re.search(r'(T2019-323-DD-KM-DWKZ-2200-[A-Z]{2}-\d{5}(?:-\d{2})?-[A-Z])', parts[-1])
                            if m_att:
                                attached_code = m_att.group(1)
                                
                    status_raw = r[3].replace('\n', ' ').strip() if r[3] else ''
                    
                    # Normalized status level
                    status_level = 'OTHER'
                    if 'LEVEL A' in status_raw.upper():
                        status_level = 'LEVEL A'
                    elif 'LEVEL B' in status_raw.upper():
                        status_level = 'LEVEL B'
                    elif 'LEVEL C' in status_raw.upper():
                        status_level = 'LEVEL C'
                    elif 'ON-HOLD' in status_raw.upper() or 'HOLD' in status_raw.upper():
                        status_level = 'ON-HOLD'
                        
                    # Extract base code without revision suffix
                    base_m = re.search(r'(T2019-323-DD-KM-DWKZ-2200-[A-Z]{2}-\d{5})', submitted_code)
                    base_code = base_m.group(1) if base_m else submitted_code
                    
                    status_records[base_code] = {
                        'tc1084_item_n': item_n,
                        'submitted_code': submitted_code,
                        'attached_code': attached_code,
                        'status_level': status_level,
                        'status_full': status_raw,
                        'comments': ''
                    }

    # 2. Extract commentary from pages 4 to 54 (0-indexed 3 to 53)
    full_body_text = ''
    page_offsets = []
    current_pos = 0
    for pno in range(3, 54):
        txt = doc[pno].get_text('text')
        page_offsets.append((pno + 1, current_pos, current_pos + len(txt)))
        full_body_text += txt
        current_pos += len(txt)

    # Find mentions of documents in the body to associate comments
    doc_header_re = re.compile(r'(T2019-323-DD-KM-DWKZ-2200-(?:DW|RP)-\d{5}(?:-\d{2})?)')
    mentions = []
    for m in doc_header_re.finditer(full_body_text):
        full_mention = m.group(1)
        base_mention = full_mention[:34]  # Length of T2019-323-DD-KM-DWKZ-2200-XX-YYYYY
        mentions.append({
            'full_code': full_mention,
            'base_code': base_mention,
            'start': m.start(),
            'end': m.end()
        })

    # Associate text between mentions to the preceding document
    for i, mention in enumerate(mentions):
        base_code = mention['base_code']
        start_idx = mention['end']
        end_idx = mentions[i+1]['start'] if i + 1 < len(mentions) else min(start_idx + 2500, len(full_body_text))
        
        # Don't capture giant cross-mentions, keep clean block
        block = full_body_text[start_idx:end_idx].strip()
        # Clean out page header boilerplate
        cleaned_lines = []
        for line in block.split('\n'):
            line_str = line.strip()
            if not line_str:
                continue
            if any(skip in line_str for skip in [
                'Port Harcourt Crescent', 'team@teamnigeria.com', 'File Name:',
                'Document Reference no.', 'PROJECT: KANO', 'MAIN CONTRACTOR:',
                'CONSULTANT: TEAM', '30 085 00', 'CLIENT: FEDERAL MINISTRY'
            ]):
                continue
            cleaned_lines.append(line_str)
            
        comment_summary = ' '.join(cleaned_lines[:15])  # First 15 lines of commentary
        if base_code in status_records:
            if not status_records[base_code]['comments']:
                status_records[base_code]['comments'] = comment_summary
            else:
                # If already set, append additional note
                if comment_summary and comment_summary not in status_records[base_code]['comments']:
                    status_records[base_code]['comments'] += " | " + comment_summary

    return status_records


def parse_tc1153_tables_and_comments():
    doc = pymupdf.open(TC_1153_PATH)
    status_records = {}
    
    # 1. Parse status table (Pages 7 to 9, 0-indexed 6 to 8)
    for pno in range(6, len(doc)):
        page = doc[pno]
        for t in page.find_tables().tables:
            for r in t.extract():
                if r and len(r) >= 4 and r[0] and r[0].strip().isdigit():
                    item_n = int(r[0].strip())
                    title = r[1].replace('\n', ' ').strip() if r[1] else ''
                    doc_raw = r[2].replace('\n', ' ') if r[2] else ''
                    m = re.search(r'(T2019-323-DD-KM-DWKZ-2200-[A-Z]{2}-\d{5}(?:-\d{2})?)', doc_raw)
                    submitted_code = m.group(1) if m else ''
                    
                    attached_code = None
                    if '---' in doc_raw:
                        parts = doc_raw.split('---')
                        if len(parts) > 1:
                            m_att = re.search(r'(T2019-323-DD-KM-DWKZ-2200-[A-Z]{2}-\d{5}(?:-\d{2})?-[A-Z])', parts[-1])
                            if m_att:
                                attached_code = m_att.group(1)
                                
                    status_raw = r[3].replace('\n', ' ').strip() if r[3] else ''
                    
                    status_level = 'OTHER'
                    if 'LEVEL A' in status_raw.upper():
                        status_level = 'LEVEL A'
                    elif 'LEVEL B' in status_raw.upper():
                        status_level = 'LEVEL B'
                    elif 'LEVEL C' in status_raw.upper():
                        status_level = 'LEVEL C'
                    elif 'ON-HOLD' in status_raw.upper():
                        status_level = 'ON-HOLD'
                        
                    base_m = re.search(r'(T2019-323-DD-KM-DWKZ-2200-[A-Z]{2}-\d{5})', submitted_code)
                    base_code = base_m.group(1) if base_m else submitted_code
                    
                    # Extract reviewed revision
                    rev_m = re.search(r'-(\d{2})$', submitted_code)
                    reviewed_rev = rev_m.group(1) if rev_m else None
                    
                    status_records[base_code] = {
                        'tc1153_item_n': item_n,
                        'reviewed_doc_code': submitted_code,
                        'reviewed_revision': reviewed_rev,
                        'attached_code': attached_code,
                        'status_level': status_level,
                        'status_full': status_raw,
                        'comments': ''
                    }

    # 2. Extract commentary from pages 1 to 7 (0-indexed 0 to 6)
    full_body_text = ''
    for pno in range(0, min(7, len(doc))):
        full_body_text += doc[pno].get_text('text')

    doc_header_re = re.compile(r'(T2019-323-DD-KM-DWKZ-2200-(?:DW|RP)-\d{5}(?:-\d{2})?)')
    mentions = []
    for m in doc_header_re.finditer(full_body_text):
        full_mention = m.group(1)
        base_mention = full_mention[:34]
        mentions.append({
            'full_code': full_mention,
            'base_code': base_mention,
            'start': m.start(),
            'end': m.end()
        })

    for i, mention in enumerate(mentions):
        base_code = mention['base_code']
        start_idx = mention['end']
        end_idx = mentions[i+1]['start'] if i + 1 < len(mentions) else min(start_idx + 2500, len(full_body_text))
        block = full_body_text[start_idx:end_idx].strip()
        cleaned_lines = []
        for line in block.split('\n'):
            line_str = line.strip()
            if not line_str or any(skip in line_str for skip in [
                'Port Harcourt Crescent', 'team@teamnigeria.com', 'File Name:',
                'Document Reference no.', 'PROJECT: KANO', 'MAIN CONTRACTOR:',
                'CONSULTANT: TEAM', '30 174 00', 'CLIENT: FEDERAL MINISTRY'
            ]):
                continue
            cleaned_lines.append(line_str)
        comment_summary = ' '.join(cleaned_lines[:15])
        if base_code in status_records:
            if not status_records[base_code]['comments']:
                status_records[base_code]['comments'] = comment_summary

    return status_records


def main():
    print("=" * 80)
    print("PHASE 1: SECTION 02 (DWKZ) SUBMISSION INVENTORY & VETTING REGISTER")
    print("=" * 80)

    # 1. Verify existence of primary files
    for p in [TRANSMITTAL_PATH, TC_1084_PATH, TC_1153_PATH, TC_417_PATH]:
        if not os.path.exists(p):
            print(f"ERROR: Missing expected file: {p}")
            sys.exit(1)
        print(f"Verified input: {os.path.basename(p)}")

    # 2. Inspect files in Doc no. 1084
    dir_files = os.listdir(DOC_1084_DIR)
    dir_file_set = set(dir_files)
    drawing_pdfs_in_dir = [f for f in dir_files if f.startswith('T2019-323-DD-KM-DWKZ-2200-DW-') and f.endswith('.pdf')]
    report_pdfs_in_dir = [f for f in dir_files if f.startswith('T2019-323-DD-KM-DWKZ-2200-RP-') and f.endswith('.pdf')]
    print(f"\nDirectory 'Doc no. 1084' inventory:")
    print(f"  Total files: {len(dir_files)}")
    print(f"  Drawing PDFs: {len(drawing_pdfs_in_dir)}")
    print(f"  Report PDFs: {len(report_pdfs_in_dir)}")
    print(f"  Transmittal: Transmittal sheet #3848.xlsx (present)")
    print(f"  Consultant TCs: 2 present (TC 1084/26 and TC 1153/26)")

    # 3. Parse Transmittal Sheet #3848.xlsx
    wb = openpyxl.load_workbook(TRANSMITTAL_PATH, data_only=True)
    ws = wb.active
    rev_headers = [str(ws.cell(6, c).value or '').strip() for c in range(8, 19)]
    print(f"\nTransmittal Revision Columns: {rev_headers}")

    transmittal_records = []
    # Stop before scanning excessive empty rows
    for r in range(10, 190):
        c2 = str(ws.cell(r, 2).value or '').strip()
        c3 = str(ws.cell(r, 3).value or '').strip()
        disc = str(ws.cell(r, 4).value or '').strip()
        sec = str(ws.cell(r, 5).value or '').strip()
        status = str(ws.cell(r, 6).value or '').strip()

        if not c2 or c2 == 'REPORT':
            continue

        latest_rev = None
        latest_date = None
        for c_idx, rev_name in enumerate(rev_headers):
            val = ws.cell(r, 8 + c_idx).value
            if val is not None and str(val).strip() != '':
                latest_rev = rev_name
                latest_date = str(val).strip()

        # Handle Report row special code format
        if 'RP-00001' in c2:
            base_doc_number = 'T2019-323-DD-KM-DWKZ-2200-RP-00001'
        else:
            base_doc_number = c2

        transmittal_records.append({
            'row': r,
            'base_doc_number': base_doc_number,
            'submitted_revision': latest_rev,
            'transmittal_date': latest_date,
            'title': c3,
            'discipline': disc,
            'section': sec,
            'transmittal_status': status
        })

    print(f"Total documents extracted from Transmittal #3848: {len(transmittal_records)}")

    # 4. Parse TC 1084 and TC 1153
    print("\nParsing Consultant Technical Comment TC 1084/26...")
    tc1084_data = parse_tc1084_tables_and_comments()
    print(f"  TC 1084 statuses parsed: {len(tc1084_data)}")

    print("Parsing Consultant Technical Comment TC 1153/26...")
    tc1153_data = parse_tc1153_tables_and_comments()
    print(f"  TC 1153 statuses parsed: {len(tc1153_data)}")

    # 5. Build Comprehensive Drawing Register
    register = []
    reconciliation_matched = 0
    reconciliation_missing = []

    for item in transmittal_records:
        base_code = item['base_doc_number']
        rev = item['submitted_revision']
        title = item['title']
        disc = item['discipline']
        sec = item['section']
        t_status = item['transmittal_status']

        full_doc_code = f"{base_code}-{rev}"
        category = categorize_drawing(base_code, title)
        start_pk, end_pk, chainage_str = parse_chainages_from_title(title)

        # Reconcile PDF filename
        expected_pdf = f"{full_doc_code}.pdf"
        pdf_path = os.path.join(DOC_1084_DIR, expected_pdf)
        pdf_exists = os.path.exists(pdf_path)
        file_size = os.path.getsize(pdf_path) if pdf_exists else None

        if pdf_exists:
            reconciliation_matched += 1
        else:
            reconciliation_missing.append(expected_pdf)

        # TC 1084 info
        tc1084_entry = tc1084_data.get(base_code, {})
        tc1084_status = tc1084_entry.get('status_level', 'UNREVIEWED')
        tc1084_full = tc1084_entry.get('status_full', '')
        tc1084_att = tc1084_entry.get('attached_code', None)
        tc1084_comm = tc1084_entry.get('comments', '')
        tc1084_item = tc1084_entry.get('tc1084_item_n', None)

        # TC 1153 info
        tc1153_entry = tc1153_data.get(base_code, {})
        is_tc1153_reviewed = base_code in tc1153_data
        tc1153_status = tc1153_entry.get('status_level', None)
        tc1153_full = tc1153_entry.get('status_full', None)
        tc1153_att = tc1153_entry.get('attached_code', None)
        tc1153_comm = tc1153_entry.get('comments', None)
        tc1153_item = tc1153_entry.get('tc1153_item_n', None)
        tc1153_rev = tc1153_entry.get('reviewed_revision', None)

        # Effective status determination
        # Rule: TC 1153/26 is chronologically later than TC 1084/26.
        if is_tc1153_reviewed:
            effective_status = tc1153_status
            if tc1153_status != tc1084_status:
                precedence_note = (
                    f"Status updated in later TC 1153/26 from '{tc1084_status}' (Rev {rev}) "
                    f"to '{tc1153_status}' (Rev {tc1153_rev})."
                )
            else:
                precedence_note = f"Status confirmed as '{effective_status}' in later TC 1153/26."
        else:
            effective_status = tc1084_status
            precedence_note = "Evaluated under TC 1084/26; not re-evaluated under TC 1153/26."

        record = {
            'doc_number': base_code,
            'submitted_revision': rev,
            'submitted_doc_code': full_doc_code,
            'title': title,
            'discipline': disc,
            'section': sec,
            'category': category,
            'start_pk': start_pk,
            'end_pk': end_pk,
            'chainage_str': chainage_str,
            'transmittal_status': t_status,
            'pdf_filename': expected_pdf,
            'pdf_present': pdf_exists,
            'file_size_bytes': file_size,
            'tc1084': {
                'reviewed': base_code in tc1084_data,
                'item_n': tc1084_item,
                'status_level': tc1084_status,
                'status_full': tc1084_full,
                'attached_code': tc1084_att,
                'comments': tc1084_comm
            },
            'tc1153': {
                'reviewed': is_tc1153_reviewed,
                'item_n': tc1153_item,
                'reviewed_revision': tc1153_rev,
                'status_level': tc1153_status,
                'status_full': tc1153_full,
                'attached_code': tc1153_att,
                'comments': tc1153_comm
            },
            'effective_status': effective_status,
            'precedence_note': precedence_note,
            'tc417_superseded': True
        }
        register.append(record)

    # 6. Add explicit entry for Symbology drawing DW-03000 (Prime Directive: record the gap)
    symbology_base = 'T2019-323-DD-KM-DWKZ-2200-DW-03000'
    symb_tc1153 = tc1153_data.get(symbology_base, {})
    symbology_record = {
        'doc_number': symbology_base,
        'submitted_revision': None,
        'submitted_doc_code': 'T2019-323-DD-KM-DWKZ-2200-DW-03000',
        'title': 'Drainage - Symbology',
        'discipline': 'DRN',
        'section': 'S02',
        'category': 'Symbology Key',
        'start_pk': None,
        'end_pk': None,
        'chainage_str': None,
        'transmittal_status': 'OMITTED_IN_SUBMISSION_3848',
        'pdf_filename': None,
        'pdf_present': False,
        'file_size_bytes': 0,
        'tc1084': {
            'reviewed': True,
            'item_n': None,
            'status_level': 'OMITTED',
            'status_full': 'Not included in submission 3848',
            'attached_code': None,
            'comments': 'The updated version of above referenced document is not included in this submission.'
        },
        'tc1153': {
            'reviewed': True,
            'item_n': symb_tc1153.get('tc1153_item_n', 1),
            'reviewed_revision': symb_tc1153.get('reviewed_revision', '03'),
            'status_level': symb_tc1153.get('status_level', 'LEVEL B'),
            'status_full': symb_tc1153.get('status_full', 'LEVEL B Proceed Subject to Amendment as Noted'),
            'attached_code': symb_tc1153.get('attached_code', 'T2019-323-DD-KM-DWKZ-2200-DW-03000-03-B'),
            'comments': symb_tc1153.get('comments', 'Evaluated as Level B in later TC 1153/26, but drawing file is absent from Doc no. 1084.')
        },
        'effective_status': 'ABSENT_FROM_FOLDER (LEVEL B IN TC 1153)',
        'precedence_note': (
            'Omitted from Transmittal 3848 and absent from Doc no. 1084. Evaluated as Level B under '
            'subsequent Transmittal 4181 in TC 1153/26, but file not in local submission folder.'
        ),
        'tc417_superseded': True
    }
    # Append as special reference entry
    register.append(symbology_record)

    # 7. Write to JSON
    os.makedirs(os.path.dirname(OUT_JSON_PATH), exist_ok=True)
    with open(OUT_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump({
            'section': 'Section 02 (DWKZ)',
            'section_extent': {
                'start_nominal_pk': 18400.0,
                'dw03002_start_pk': 19800.0,
                'end_pk': 82902.439,
                'span_m': 63102.439
            },
            'transmittal': {
                'number': 3848,
                'date': '2026-01-23',
                'contractor_letters': ['NIG/KAMA/FM/2026/2475', 'NIG/KAMA/FM/2026/2479', 'NIG/KAMA/FM/2026/2480'],
                'total_documents_listed': len(transmittal_records),
                'reconciliation_matched': reconciliation_matched,
                'reconciliation_missing': reconciliation_missing
            },
            'vetting_comments': {
                'tc1084_26': {
                    'reference': 'KMD TC 1084 26 HYD 30 085 00',
                    'date': '2026-02-25',
                    'total_reviewed': len(tc1084_data),
                    'status': 'Comprehensive review of Transmittal 3848'
                },
                'tc1153_26': {
                    'reference': 'KMD TC 1153 26 HYD 30 174 00',
                    'date': '2026-04-13',
                    'total_reviewed': len(tc1153_data),
                    'status': 'Subsequent review of 16 revised documents (Transmittal 4181); takes precedence over TC 1084'
                },
                'tc417_25': {
                    'reference': 'KMD TC 417 25 HYD 30 046 00',
                    'date': '2025-02-14',
                    'status': 'Superseded (reviewed Transmittal 2042 in 2025)'
                }
            },
            'documents': register
        }, f, indent=2, ensure_ascii=False)

    print(f"\nSuccessfully wrote drawing register to:\n  {OUT_JSON_PATH}")
    print(f"  Total records in register: {len(register)} (173 submitted + 1 symbology reference)")

    # 8. Print Breakdown and Summary Statistics
    cat_counts = Counter(r['category'] for r in register if r['category'] != 'Symbology Key')
    eff_status_counts = Counter(r['effective_status'] for r in register if r['category'] != 'Symbology Key')
    tc1084_status_counts = Counter(r['tc1084']['status_level'] for r in register if r['category'] != 'Symbology Key')

    print("\n" + "=" * 80)
    print("SUBMISSION INVENTORY SUMMARY BREAKDOWN")
    print("=" * 80)
    print(f"Total Listed in Transmittal #3848 : {len(transmittal_records)}")
    print(f"Reconciliation against Doc no. 1084: {reconciliation_matched} matched, {len(reconciliation_missing)} missing")
    print("\nDocument Breakdown by Category:")
    for cat, cnt in sorted(cat_counts.items()):
        print(f"  {cat:<25}: {cnt:>3} documents")

    print("\nTC 1084/26 Status Distribution (25 Feb 2026):")
    for st, cnt in sorted(tc1084_status_counts.items()):
        print(f"  {st:<15}: {cnt:>3} documents")

    print("\nEffective Status Distribution (Accounting for later TC 1153/26, 13 Apr 2026):")
    for st, cnt in sorted(eff_status_counts.items()):
        print(f"  {st:<15}: {cnt:>3} documents")

    print("\nDocuments with Status Changed in Later TC 1153/26:")
    changed_count = 0
    for r in register:
        if r['category'] == 'Symbology Key':
            continue
        if r['tc1153']['reviewed'] and r['tc1153']['status_level'] != r['tc1084']['status_level']:
            changed_count += 1
            print(f"  {r['doc_number']:<36}: TC 1084 '{r['tc1084']['status_level']}' -> TC 1153 '{r['tc1153']['status_level']}' (Rev {r['tc1153']['reviewed_revision']})")
    print(f"  Total status changes in TC 1153: {changed_count}")

    print("\nDawanau Yard ON-HOLD Documents (Employer Relocation Directive 04-09-2025):")
    on_hold = [r for r in register if r['effective_status'] == 'ON-HOLD']
    for oh in on_hold:
        print(f"  {oh['doc_number']:<36}: {oh['title']}")
    print(f"  Total ON-HOLD: {len(on_hold)}")

    print("\nNon-Issued Culvert Drawing Gaps Verified:")
    print("  DW-04113, DW-04114, DW-04116: Confirmed NEVER ISSUED (absent from transmittal, folder, and TC reviews).")

    print("\nSymbology Sheet Gap:")
    print("  T2019-323-DD-KM-DWKZ-2200-DW-03000: Omitted from Transmittal 3848, absent from Doc no. 1084.")
    print("  Reviewed as Rev 03 Level B in TC 1153/26, but drawing file was not provided.")


if __name__ == '__main__':
    main()
