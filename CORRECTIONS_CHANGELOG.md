# Kano–Maradi–Dutse Railway Project (Section 03: KZDR)
## Drainage Dataset Corrections Changelog

- **Date:** 2026-09-07
- **Target File:** pp/data/section03_assets.json
- **Centerline Datum:** pp/data/section03_centerline.json (PK 82+902.439 to PK 124+521.140)
- **Supervision Consultant:** T.E.A.M. Nig. Ltd.
- **Main Contractor:** MOTA-ENGIL
- **Author:** Engr. Abdulaziz A. A. (Drainage Construction Execution)
- **Primary Evidence Sources:**
  - AutoCAD Vector Plan Sheets: Doc no. 1211\T2019-323-DD-KM-KZDR-2200-DW-030NN-RR.pdf (Transmittal 4366) and Doc. No 1052 (Transmittal 3825, sheets DW-03001-05 and DW-03006-05).
  - Hydraulic Schedule: Design Report T2019-323-DD-KM-KZDR-2200-RP-00001-09 Appendix II (Page 27–41).
  - Work Register: Doc no. 1211\_Analysis\KZDR_App_Correction_Register.xlsx.
  - Master Reference: Doc no. 1211\_Analysis\KZDR_S03_Drainage_Master_Dataset.xlsx.

---

## Phase 1 — Verification Sample Audit (Completed 2026-09-07)

Prior to modifying any dataset records, three test items were selected at random across three separate register tabs and audited against source vector PDFs and design documents:

| Test Sample | Register Tab & Row | Target Item | Verified Evidence from Primary Sources | Result |
|:---|:---|:---|:---|:---|
| **Sample 1** | Culverts (Row 4) | CH 89+140.000 (ID 89.1, 1x 2.00x2.00 Box) | Confirmed on sheet DW-03005-06 (CH=89+140.005, callout H89.1) and Design Report RP-00001-09 Appendix II (Page 33: 1 cell 2.00x2.00 m, =6.16\,\text{m}^3/\text{s}$, =0.24\%$, =15.00\,\text{m}$). | **VERIFIED (100% match)** |
| **Sample 2** | Ditch Runs (Row 5) | CH 85+810–86+100 R (SD-008, Type 1) | Confirmed on sheet DW-03003-06 (Upper Strip: red text .33\rightarrow 463.05$ with slopes .17\%$ and .25\%$ situated below centerline at =318\text{--}364\,\text{pt}$, callout TRAPEZOIDAL SIDE DITCH h:0.75m / b:0.75m). | **VERIFIED (100% match)** |
| **Sample 3** | Side and Type (Row 5) | CH 96+010–96+590 (Flip R $\rightarrow$ L) | Confirmed on sheet DW-03010-07 (Lower Strip: azure invert levels .21\rightarrow 455.01$ and .37\rightarrow 455.77$ situated at =849\text{--}879\,\text{pt}$, strictly above centerline =937\text{--}959\,\text{pt}$, establishing Left side). | **VERIFIED (100% match)** |

---

## Corrections Log

| Record ID | Chainage Extent | Action | Register Reference | Drawing / Document Reference | Notes & Field Data Continuity |
|:---|:---|:---|:---|:---|:---|

### Phase 2 — Cross-Drainage Corrections (Culverts Tab)

| Record ID | Chainage Extent | Action | Register Reference | Drawing / Document Reference | Notes & Field Data Continuity |
|:---|:---|:---|:---|:---|:---|
| asset_178 | PK 89+140 | ADD | Culverts (Row 4) | DW-03005-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Single Box Culvert 1x(2.00 x 2.00m) (ID 89.1, Basin B3.25, Q=6.16 m3/s). Initial field data intact. |
| asset_179 | PK 89+660 | ADD | Culverts (Row 5) | DW-03005-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Single Box Culvert 1x(2.50 x 2.50m) (ID 89.3, Basin B3.27, Q=11.02 m3/s). Initial field data intact. |
| asset_180 | PK 92+525 | ADD | Culverts (Row 6) | DW-03007-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Single Box Culvert 1x(2.00 x 2.00m) (ID 92.1, Basin B3.31, Q=5.73 m3/s). Initial field data intact. |
| asset_181 | PK 92+623 | ADD | Culverts (Row 7) | DW-03008-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 92.2, Basin B3.32, Q=0.45 m3/s). Initial field data intact. |
| asset_182 | PK 94+948 | ADD | Culverts (Row 8) | DW-03009-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Triple Box Culvert 3x(2.00 x 2.00m) (ID 94.1, Basin B3.36, Q=21.31 m3/s). Initial field data intact. |
| asset_183 | PK 95+450 | ADD | Culverts (Row 9) | DW-03010-07 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1500 (ID 95.1, Basin B3.37, Q=2.12 m3/s). Initial field data intact. |
| asset_184 | PK 95+795 | ADD | Culverts (Row 10) | DW-03010-07 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Triple Box Culvert 3x(2.00 x 2.00m) (ID 95.2, Basin B3.38, Q=7.31 m3/s). Initial field data intact. |
| asset_185 | PK 96+146 | ADD | Culverts (Row 11) | DW-03010-07 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1500 (ID 96.1, Basin B3.39, Q=2.47 m3/s). Initial field data intact. |
| asset_186 | PK 96+615 | ADD | Culverts (Row 12) | DW-03010-07 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Triple Box Culvert 3x(2.00 x 2.00m) (ID 96.2, Basin B3.40, Q=14.98 m3/s). Initial field data intact. |
| asset_187 | PK 97+175 | ADD | Culverts (Row 13) | DW-03011-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Single Box Culvert 1x(2.50 x 2.50m) (ID 97.2, Basin B3.42, Q=11.76 m3/s). Initial field data intact. |
| asset_188 | PK 97+427 | ADD | Culverts (Row 14) | DW-03011-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Single Box Culvert 1x(2.00 x 2.00m) (ID 97.3, Basin B3.44, Q=5.51 m3/s). Initial field data intact. |
| asset_189 | PK 98+145 | ADD | Culverts (Row 15) | DW-03011-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 98.1, Basin B3.45, Q=0.58 m3/s). Initial field data intact. |
| asset_190 | PK 98+499 | ADD | Culverts (Row 16) | DW-03012-07 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 98.2, Basin B3.46, Q=0.46 m3/s). Initial field data intact. |
| asset_191 | PK 98+797 | ADD | Culverts (Row 17) | DW-03012-07 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1500 (ID 98.3, Basin B3.47, Q=1.39 m3/s). Initial field data intact. |
| asset_192 | PK 98+996 | ADD | Culverts (Row 18) | DW-03012-07 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 98.4, Basin B3.48, Q=0.34 m3/s). Initial field data intact. |
| asset_193 | PK 99+220 | ADD | Culverts (Row 19) | DW-03012-07 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 99.1, Basin B3.49, Q=0.93 m3/s). Initial field data intact. |
| asset_194 | PK 99+399 | ADD | Culverts (Row 20) | DW-03012-07 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 99.2, Basin B3.50, Q=0.52 m3/s). Initial field data intact. |
| asset_195 | PK 99+602 | ADD | Culverts (Row 21) | DW-03013-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 99.3, Basin B3.51, Q=1.23 m3/s). Initial field data intact. |
| asset_196 | PK 99+866 | ADD | Culverts (Row 22) | DW-03013-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Single Box Culvert 1x(2.00 x 2.00m) (ID 99.4, Basin B3.52, Q=3.7 m3/s). Initial field data intact. |
| asset_197 | PK 100+174 | ADD | Culverts (Row 23) | DW-03013-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 100.1, Basin B3.53, Q=1.08 m3/s). Initial field data intact. |
| asset_198 | PK 100+778 | ADD | Culverts (Row 24) | DW-03013-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Single Box Culvert 1x(2.00 x 2.00m) (ID 100.2, Basin B3.55, Q=3.86 m3/s). Initial field data intact. |
| asset_199 | PK 100+909 | ADD | Culverts (Row 25) | DW-03013-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 100.3, Basin B3.56, Q=0.34 m3/s). Initial field data intact. |
| asset_200 | PK 101+080 | ADD | Culverts (Row 26) | DW-03014-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Single Box Culvert 1x(2.00 x 2.00m) (ID 101.1, Basin B3.57, Q=2.98 m3/s). Initial field data intact. |
| asset_201 | PK 101+866 | ADD | Culverts (Row 27) | DW-03014-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1500 (ID 101.2, Basin B3.58, Q=2.03 m3/s). Initial field data intact. |
| asset_202 | PK 102+010 | ADD | Culverts (Row 28) | DW-03014-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 102.1, Basin B3.59, Q=0.46 m3/s). Initial field data intact. |
| asset_203 | PK 102+905 | ADD | Culverts (Row 29) | DW-03015-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 102.2, Basin B3.62, Q=0.23 m3/s). Initial field data intact. |
| asset_204 | PK 103+450 | ADD | Culverts (Row 30) | DW-03015-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1500 (ID 103.1, Basin B3.61, Q=2.81 m3/s). Initial field data intact. |
| asset_205 | PK 103+970 | ADD | Culverts (Row 31) | DW-03016-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1500 (ID 103.2, Basin B3.63, Q=2.46 m3/s). Initial field data intact. |
| asset_206 | PK 105+334 | ADD | Culverts (Row 32) | DW-03017-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Single Box Culvert 1x(2.00 x 2.00m) (ID 105.1, Basin B3.66, Q=3.33 m3/s). Initial field data intact. |
| asset_207 | PK 105+519 | ADD | Culverts (Row 33) | DW-03017-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 105.2, Basin B3.67, Q=0.22 m3/s). Initial field data intact. |
| asset_208 | PK 107+190 | ADD | Culverts (Row 34) | DW-03018-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Single Box Culvert 1x(2.50 x 2.50m) (ID 107.1, Basin B3.70, Q=6.85 m3/s). Initial field data intact. |
| asset_209 | PK 107+750 | ADD | Culverts (Row 35) | DW-03018-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Single Box Culvert 1x(2.50 x 2.50m) (ID 107.2, Basin B3.71, Q=7.75 m3/s). Initial field data intact. |
| asset_210 | PK 109+066 | ADD | Culverts (Row 36) | DW-03019-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1500 (ID 109.1, Basin B3.75, Q=2.27 m3/s). Initial field data intact. |
| asset_211 | PK 110+172 | ADD | Culverts (Row 37) | DW-03020-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 110.1, Basin B3.79, Q=0.23 m3/s). Initial field data intact. |
| asset_212 | PK 110+306 | ADD | Culverts (Row 38) | DW-03020-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1500 (ID 110.2, Basin B3.80, Q=2.16 m3/s). Initial field data intact. |
| asset_213 | PK 110+420 | ADD | Culverts (Row 39) | DW-03020-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 110.3, Basin B3.81, Q=0.69 m3/s). Initial field data intact. |
| asset_214 | PK 110+656 | ADD | Culverts (Row 40) | DW-03020-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Single Box Culvert 1x(2.00 x 2.00m) (ID 110.4, Basin B3.82, Q=6.29 m3/s). Initial field data intact. |
| asset_215 | PK 111+017 | ADD | Culverts (Row 41) | DW-03021-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1500 (ID 111.1, Basin B3.83, Q=1.67 m3/s). Initial field data intact. |
| asset_216 | PK 111+349 | ADD | Culverts (Row 42) | DW-03021-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 111.2, Basin B3.85, Q=1.45 m3/s). Initial field data intact. |
| asset_217 | PK 111+836 | ADD | Culverts (Row 43) | DW-03021-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 111.3, Basin B3.86, Q=1.48 m3/s). Initial field data intact. |
| asset_218 | PK 111+965 | ADD | Culverts (Row 44) | DW-03021-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 111.4, Basin B3.87, Q=0.6 m3/s). Initial field data intact. |
| asset_219 | PK 112+500 | ADD | Culverts (Row 45) | DW-03022-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 112.1, Basin B3.88, Q=0.12 m3/s). Initial field data intact. |
| asset_220 | PK 112+865 | ADD | Culverts (Row 46) | DW-03022-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 112.2, Basin B3.89, Q=0.28 m3/s). Initial field data intact. |
| asset_221 | PK 113+120 | ADD | Culverts (Row 47) | DW-03022-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 113.1, Basin B3.90, Q=0.17 m3/s). Initial field data intact. |
| asset_222 | PK 113+697 | ADD | Culverts (Row 48) | DW-03023-06 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Triple Box Culvert 3x(2.50 x 2.50m) (ID 113.2, Basin B3.91, Q=20.81 m3/s). Initial field data intact. |
| asset_223 | PK 114+075 | ADD | Culverts (Row 49) | DW-03023-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 114.1, Basin B3.92, Q=1.24 m3/s). Initial field data intact. |
| asset_224 | PK 114+914 | ADD | Culverts (Row 50) | DW-03023-06 / MDDTDW220000023-31 / RP-00001 App II | Added cross-drainage structure Single Pipe Culvert 1xØø 1200 (ID 114.3, Basin B3.94, Q=0.38 m3/s). Initial field data intact. |
| asset_225 | PK 115+125 | ADD | Culverts (Row 51) | DW-03024-07 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Triple Box Culvert 3x(2.00 x 2.00m) (ID 115.1, Basin B3.95, Q=13.46 m3/s). Initial field data intact. |
| asset_226 | PK 115+495 | ADD | Culverts (Row 52) | DW-03024-07 / MDDTDW220010002 / RP-00001 App II | Added cross-drainage structure Single Box Culvert 1x(2.50 x 2.50m) (ID 115.2, Basin B3.96, Q=7.4 m3/s). Initial field data intact. |
| asset_094 | CH 95+212 | FLAG | Culverts (Row 53) | DW-03009-06 | [FLAG] Unsubstantiated by DW-03009-06 and omitted from Design Report RP-00001 Rev 09 Appendix II. Marked for site verification. Existing record retained. |
| asset_133 | CH 110+111 | FLAG | Culverts (Row 54) | DW-03020-06 | [FLAG] Unsubstantiated by DW-03020-06 and omitted from Design Report RP-00001 Rev 09 Appendix II. Marked for site verification. Existing record retained. |

### Phase 3 — Longitudinal Ditch Runs Corrections (Ditch Runs Tab)

| Record ID | Chainage Extent | Action | Register Reference | Drawing / Document Reference | Notes & Field Data Continuity |
|:---|:---|:---|:---|:---|:---|
| asset_227 | PK 84+900 – PK 85+140 (Left) | ADD | Ditch Runs (Row 4) | DW-03002-07 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-001, FS-036). Initial field data intact. |
| asset_228 | PK 85+810 – PK 86+100 (Right) | ADD | Ditch Runs (Row 5) | DW-03003-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Side Ditch (Type 1 Standard) (SD-008). Initial field data intact. |
| asset_229 | PK 86+530 – PK 86+700 (Left) | ADD | Ditch Runs (Row 6) | DW-03003-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-004, FS-005, FS-006, FS-038). Initial field data intact. |
| asset_230 | PK 87+330 – PK 87+510 (Left) | ADD | Ditch Runs (Row 7) | DW-03004-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 7) (FS-040). Initial field data intact. |
| asset_231 | PK 87+700 – PK 87+850 (Left) | ADD | Ditch Runs (Row 8) | DW-03004-06 / MDDTDW220010001 | Added longitudinal ditch run Trapezoidal Lined Toe Ditch (Type 12) (FS-007). Initial field data intact. |
| asset_232 | PK 88+570 – PK 88+800 (Right) | ADD | Ditch Runs (Row 9) | DW-03005-06 / MDDTDW220010001 | Added longitudinal ditch run Trapezoidal Lined Toe Ditch (Type 12) (FS-086, FS-087). Initial field data intact. |
| asset_233 | PK 89+030 – PK 89+400 (Right) | ADD | Ditch Runs (Row 10) | DW-03005-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-061, FS-062, FS-088, FS-089). Initial field data intact. |
| asset_234 | PK 90+560 – PK 90+950 (Left) | ADD | Ditch Runs (Row 11) | DW-03006-05 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 4) (FS-009, FS-010, FS-121). Initial field data intact. |
| asset_235 | PK 90+730 – PK 90+950 (Right) | ADD | Ditch Runs (Row 12) | DW-03006-05 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 4) (FS-081, FS-091). Initial field data intact. |
| asset_236 | PK 91+110 – PK 91+340 (Left) | ADD | Ditch Runs (Row 13) | DW-03006-05 / DW-03007-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 4, Type 7) (FS-041, FS-121). Initial field data intact. |
| asset_237 | PK 96+010 – PK 96+590 (Left) | ADD | Ditch Runs (Row 14) | DW-03010-07 / MDDTDW220010001 | Added longitudinal ditch run Trapezoidal Lined Toe Ditch (Type 12) (FS-011, FS-012). Initial field data intact. |
| asset_238 | PK 97+190 – PK 97+340 (Right) | ADD | Ditch Runs (Row 15) | DW-03011-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-064, FS-093). Initial field data intact. |
| asset_239 | PK 97+540 – PK 97+760 (Left) | ADD | Ditch Runs (Row 16) | DW-03011-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-014, FS-042). Initial field data intact. |
| asset_240 | PK 98+150 – PK 98+390 (Left) | ADD | Ditch Runs (Row 17) | DW-03011-06 / DW-03012-07 / MDDTDW220010001 | Added longitudinal ditch run Trapezoidal Lined Toe Ditch (Type 12) (FS-015). Initial field data intact. |
| asset_241 | PK 100+850 – PK 101+880 (Right) | ADD | Ditch Runs (Row 18) | DW-03013-06 / DW-03014-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-065, FS-095, FS-096). Initial field data intact. |
| asset_242 | PK 102+060 – PK 102+860 (Right) | ADD | Ditch Runs (Row 19) | DW-03014-06 / DW-03015-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 4, Type 7) (FS-066, FS-082, FS-098, FS-099). Initial field data intact. |
| asset_243 | PK 102+700 – PK 102+890 (Left) | ADD | Ditch Runs (Row 20) | DW-03015-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-017, FS-044). Initial field data intact. |
| asset_244 | PK 102+930 – PK 103+860 (Left) | ADD | Ditch Runs (Row 21) | DW-03015-06 / DW-03016-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-018, FS-019, FS-045, FS-046). Initial field data intact. |
| asset_245 | PK 104+530 – PK 105+340 (Right) | ADD | Ditch Runs (Row 22) | DW-03016-06 / DW-03017-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-067, FS-100). Initial field data intact. |
| asset_246 | PK 105+350 – PK 105+560 (Left) | ADD | Ditch Runs (Row 23) | DW-03017-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-020, FS-021, FS-048). Initial field data intact. |
| asset_247 | PK 107+750 – PK 108+250 (Left) | ADD | Ditch Runs (Row 24) | DW-03018-06 / DW-03019-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-022, FS-050). Initial field data intact. |
| asset_248 | PK 108+420 – PK 109+210 (Right) | ADD | Ditch Runs (Row 25) | DW-03019-06 / MDDTDW220010001 | Added longitudinal ditch run Trapezoidal Lined Toe Ditch (Type 12) (FS-101, FS-102, FS-103). Initial field data intact. |
| asset_249 | PK 110+500 – PK 111+740 (Left) | ADD | Ditch Runs (Row 26) | DW-03020-06 / DW-03021-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-023, FS-024, FS-025, FS-026, FS-051, FS-052, FS-053). Initial field data intact. |
| asset_250 | PK 111+980 – PK 112+420 (Left) | ADD | Ditch Runs (Row 27) | DW-03021-06 / DW-03022-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-028, FS-054). Initial field data intact. |
| asset_251 | PK 112+980 – PK 113+210 (Right) | ADD | Ditch Runs (Row 28) | DW-03022-06 / MDDTDW220010001 | Added longitudinal ditch run Trapezoidal Lined Toe Ditch (Type 12) (FS-104, FS-105). Initial field data intact. |
| asset_252 | PK 113+450 – PK 114+020 (Right) | ADD | Ditch Runs (Row 29) | DW-03022-06 / DW-03023-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-068, FS-106, FS-107, FS-108). Initial field data intact. |
| asset_253 | PK 114+090 – PK 114+440 (Right) | ADD | Ditch Runs (Row 30) | DW-03023-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-069, FS-109, FS-110). Initial field data intact. |
| asset_254 | PK 114+360 – PK 114+590 (Left) | ADD | Ditch Runs (Row 31) | DW-03023-06 / MDDTDW220010001 | Added longitudinal ditch run Trapezoidal Lined Toe Ditch (Type 12) (FS-029, FS-030). Initial field data intact. |
| asset_255 | PK 114+510 – PK 114+810 (Right) | ADD | Ditch Runs (Row 32) | DW-03023-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 7) (FS-070). Initial field data intact. |
| asset_256 | PK 115+150 – PK 116+260 (Right) | ADD | Ditch Runs (Row 33) | DW-03024-07 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-071, FS-072, FS-112, FS-113, FS-114, FS-115). Initial field data intact. |
| asset_257 | PK 116+440 – PK 116+810 (Left) | ADD | Ditch Runs (Row 34) | DW-03025-06 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-031, FS-055). Initial field data intact. |
| asset_258 | PK 118+610 – PK 119+290 (Left) | ADD | Ditch Runs (Row 35) | DW-03026-07 / DW-03027-06 / MDDTDW220010001 | Added longitudinal ditch run Trapezoidal Lined Toe Ditch (Type 12) (FS-032). Initial field data intact. |
| asset_259 | PK 119+350 – PK 119+620 (Left) | ADD | Ditch Runs (Row 36) | DW-03027-06 / MDDTDW220010001 | Added longitudinal ditch run Trapezoidal Lined Toe Ditch (Type 12) (FS-033). Initial field data intact. |
| asset_260 | PK 119+900 – PK 120+240 (Left) | ADD | Ditch Runs (Row 37) | DW-03027-06 / MDDTDW220010001 | Added longitudinal ditch run Trapezoidal Lined Toe Ditch (Type 12) (FS-034). Initial field data intact. |
| asset_261 | PK 120+530 – PK 121+290 (Right) | ADD | Ditch Runs (Row 38) | DW-03027-06 / DW-03028-05 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-075, FS-117). Initial field data intact. |
| asset_262 | PK 121+570 – PK 122+190 (Right) | ADD | Ditch Runs (Row 39) | DW-03028-05 / DW-03029-05 / MDDTDW220010001 | Added longitudinal ditch run Concrete Lined Toe Ditch (Type 12, Type 7) (FS-076, FS-118). Initial field data intact. |
| asset_263 | PK 122+830 – PK 123+910 (Left) | ADD | Ditch Runs (Row 40) | DW-03029-05 / DW-03030-05 / MDDTDW220010001 | Added longitudinal ditch run Trapezoidal Lined Toe Ditch (Type 12) (FS-035). Initial field data intact. |
| asset_264 | PK 123+260 – PK 123+610 (Right) | ADD | Ditch Runs (Row 41) | DW-03029-05 / DW-03030-05 / MDDTDW220010001 | Added longitudinal ditch run Trapezoidal Lined Toe Ditch (Type 12) (FS-120). Initial field data intact. |
| asset_013 | PK 83+725 – PK 84+800 | FLAG | Ditch Runs (Row 42) | DW-03001-05 | [FLAG] No drawing symbology found on DW-03001-05 supporting this run. Retained pending site verification. Existing record retained. |
| asset_020 | PK 84+891 – PK 85+101 | FLAG | Ditch Runs (Row 43) | DW-03002-07 | [FLAG] No drawing symbology found on DW-03002-07 supporting this run. Retained pending site verification. Existing record retained. |
| asset_072 | PK 89+700 – PK 90+246 | FLAG | Ditch Runs (Row 44) | DW-03005-06 / DW-03006-05 | [FLAG] No drawing symbology found on DW-03005-06 / DW-03006-05 supporting this run. Retained pending site verification. Existing record retained. |
| asset_073 | PK 89+700 – PK 90+246 | FLAG | Ditch Runs (Row 45) | DW-03006-05 | [FLAG] No drawing symbology found on DW-03006-05 supporting this run. Retained pending site verification. Existing record retained. |
| asset_085 | PK 91+800 – PK 92+100 | FLAG | Ditch Runs (Row 46) | DW-03007-06 | [FLAG] No drawing symbology found on DW-03007-06 supporting this run. Retained pending site verification. Existing record retained. |
| asset_087 | PK 92+100 – PK 92+500 | FLAG | Ditch Runs (Row 47) | DW-03007-06 | [FLAG] No drawing symbology found on DW-03007-06 supporting this run. Retained pending site verification. Existing record retained. |
| asset_090 | PK 93+195 – PK 93+900 | FLAG | Ditch Runs (Row 48) | DW-03008-06 | [FLAG] No drawing symbology found on DW-03008-06; alignment intersects railway bridge BRG-2602 at CH 93+678–93+731 where continuous platform side ditch is structurally precluded. Marked for Senior Engineer review. Existing record retained. |
| asset_091 | PK 93+195 – PK 93+900 | FLAG | Ditch Runs (Row 49) | DW-03008-06 | [FLAG] No drawing symbology found on DW-03008-06; alignment intersects railway bridge BRG-2602 at CH 93+678–93+731 where continuous platform side ditch is structurally precluded. Marked for Senior Engineer review. Existing record retained. |
| asset_095 | PK 95+300 – PK 96+000 | FLAG | Ditch Runs (Row 50) | DW-03009-06 / DW-03010-07 | [FLAG] No drawing symbology found on DW-03009-06 / DW-03010-07 supporting this run. Retained pending site verification. Existing record retained. |
| asset_096 | PK 96+000 – PK 96+700 | FLAG | Ditch Runs (Row 51) | DW-03010-07 | [FLAG] No drawing symbology found on DW-03010-07 supporting this run. Retained pending site verification. Existing record retained. |
| asset_103 | PK 98+100 – PK 98+750 | FLAG | Ditch Runs (Row 52) | DW-03011-06 / DW-03012-07 | [FLAG] No drawing symbology found on DW-03011-06 / DW-03012-07 supporting this run. Retained pending site verification. Existing record retained. |
| asset_103 | PK 98+100 – PK 98+750 | FLAG | Ditch Runs (Row 53) | DW-03012-07 | [FLAG] No drawing symbology found on DW-03012-07 supporting this run. Retained pending site verification. Existing record retained. |
| asset_105 | PK 100+200 – PK 100+800 | FLAG | Ditch Runs (Row 54) | DW-03013-06 | [FLAG] No drawing symbology found on DW-03013-06 supporting this run. Retained pending site verification. Existing record retained. |
| asset_109 | PK 101+242 – PK 102+300 | FLAG | Ditch Runs (Row 55) | DW-03014-06 | [FLAG] No drawing symbology found on DW-03014-06 supporting this run. Retained pending site verification. Existing record retained. |
| asset_135 | PK 110+700 – PK 111+900 | FLAG | Ditch Runs (Row 56) | DW-03020-06 / DW-03021-06 | [FLAG] No drawing symbology found on DW-03020-06 / DW-03021-06 supporting this run. Retained pending site verification. Existing record retained. |
| asset_153 | PK 119+472 – PK 120+450 | FLAG | Ditch Runs (Row 57) | DW-03027-06 | [FLAG] No drawing symbology found on DW-03027-06 supporting this run. Retained pending site verification. Existing record retained. |

### Phase 4 — Siding and Typology Corrections (Side and Type Tab)

| Record ID | Chainage Extent | Action | Register Reference | Drawing / Document Reference | Notes & Field Data Continuity |
|:---|:---|:---|:---|:---|:---|
| asset_020 | CH 84+900 – 85+110 | FLIP SIDE | Side and Type (Row 4) | DW-03002-07 | Reconciled side discrepancy. Verified successor run on Left is asset_227. Original record retained with cross-reference note. |
| asset_096 | CH 96+010 – 96+590 | FLIP SIDE | Side and Type (Row 5) | DW-03010-07 | Reconciled side discrepancy. Verified successor run on Left is asset_237. Original record retained with cross-reference note. |
| asset_103 | CH 98+150 – 98+380 | FLIP SIDE | Side and Type (Row 6) | DW-03011-06 | Reconciled side discrepancy. Verified successor run on Left is asset_240. Original record retained with cross-reference note. |
| asset_109 | CH 101+240 – 101+880 | FLIP SIDE | Side and Type (Row 7) | DW-03014-06 | Reconciled side discrepancy. Verified successor run on Right is asset_241. Original record retained with cross-reference note. |
| asset_109 | CH 101+910 – 102+030 | FLIP SIDE | Side and Type (Row 8) | DW-03014-06 | Reconciled side discrepancy. Verified successor run on Right is asset_241. Original record retained with cross-reference note. |
| asset_109 | CH 102+060 – 102+310 | FLIP SIDE | Side and Type (Row 9) | DW-03014-06 | Reconciled side discrepancy. Verified successor run on Right is asset_242. Original record retained with cross-reference note. |
| asset_135 | CH 110+700 – 111+740 | FLIP SIDE | Side and Type (Row 10) | DW-03020-06 / DW-03021-06 | Reconciled side discrepancy. Verified successor run on Left is asset_249. Original record retained with cross-reference note. |
| asset_153 | CH 119+470 – 119+620 | FLIP SIDE | Side and Type (Row 11) | DW-03027-06 | Reconciled side discrepancy. Verified successor run on Left is asset_259. Original record retained with cross-reference note. |
| asset_013 | PK 83+725 – PK 84+800 | RETYPE | Side and Type (Row 15) | DW-03001-05 | Updated typology / technical specifications per primary drawing evidence and master dataset. Initial field data intact. |
| asset_043 | PK 86+900 – PK 87+100 | RETYPE | Side and Type (Row 18) | DW-03004-06 | Updated typology / technical specifications per primary drawing evidence and master dataset. Initial field data intact. |
| asset_072 | PK 89+700 – PK 90+246 | RETYPE | Side and Type (Row 14) | DW-03005-06 | Updated typology / technical specifications per primary drawing evidence and master dataset. Initial field data intact. |
| asset_073 | PK 89+700 – PK 90+246 | RETYPE | Side and Type (Row 14) | DW-03005-06 | Updated typology / technical specifications per primary drawing evidence and master dataset. Initial field data intact. |
| asset_065 | PK 88+800 – PK 88+975 | RETYPE | Side and Type (Row 19) | DW-03005-06 | Updated typology / technical specifications per primary drawing evidence and master dataset. Initial field data intact. |
| asset_153 | PK 119+472 – PK 120+450 | RETYPE | Side and Type (Row 20) | DW-03027-06 | Updated typology / technical specifications per primary drawing evidence and master dataset. Initial field data intact. |

### Phase 5 — Crest Ditch Corrections (Crest Ditch Tab)

| Record ID | Chainage Extent | Action | Register Reference | Drawing / Document Reference | Notes & Field Data Continuity |
|:---|:---|:---|:---|:---|:---|
| sset_014 | PK 84+444 – PK 84+569 | EDIT EXTENT | Crest Ditch (Row 13) | DW-03002-07 | Tightened extent from 84+406–84+620 to 84+444–84+569 (-89m). Geometry regenerated on Left (-22m). Quoted verbatim levels and 2.25% descent in specs. Initial field data intact. |
| asset_071 | PK 89+700 – PK 89+980 | FLAG | Crest Ditch (Row 14) | DW-03006-05 | [FLAG] Unsubstantiated by sheet DW-03006-05; no crest ditch drawn or annotated. Retained pending site verification. Existing record retained. |
| asset_092 | PK 93+500 – PK 94+300 | FLAG | Crest Ditch (Row 15) | DW-03008-06 | [FLAG] Unsubstantiated by sheet DW-03008-06; alignment intersects railway bridge BRG-2602 at CH 93+678–93+731 and no crest ditch exists on centerline. Retained pending site verification. Existing record retained. |

### Phase 6 — Missing Feature Classes & Crest Descent Point Feature

| Record ID | Chainage Extent | Action | Register Reference | Drawing / Document Reference | Notes & Field Data Continuity |
|:---|:---|:---|:---|:---|:---|
| `asset_265` | `PK 84+544` | `ADD (Point)` | Crest Ditch Descent | DW-03002-07 / DW-10003-04-A | Concrete crest ditch descent (i=2.25%, fall=0.24m) into Type 1 side ditch |
| `asset_266`..`asset_532` (267 features) | `PK 82+939` to `PK 124+485` | `ADD (Point)` | Slope Protection (SP-001 to SP-267) | DW-03001 to DW-03030 / DW-10004-02-A | Embankment riprap armor callouts marking stretches where longitudinal ditch is omitted |
| `asset_533`..`asset_842` (310 features) | `PK 82+911` to `PK 124+459` | `ADD (Point)` | Water Descents (WD-001 to WD-310) | DW-03001 to DW-03030 / DW-10003-04-A | Precast half-round chutes preventing shoulder ditches exceeding permissible hydraulic run lengths |
