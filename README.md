# Lobotrans - Operational Automation Hub

> **Internal Tooling Suite developed for Transwolff's Operational Control Center.**

## 🎯 Overview
Lobotrans is a web-based suite of tools designed to automate and standardize daily operational reporting tasks. It replaces manual document formatting (Word/Excel) with structured web forms that automatically generate professional, standardized reports using pre-defined templates.

The system is used daily by the operational team to handle critical workflows such as accident reporting, occurrence logging, and real-time alerts.

## 🚀 Key Modules

### 1. Report Generator (Acidentes & Ocorrências)
Eliminates the need for manual Word document formatting.
- **Dynamic Forms:** Captures structured data (dates, locations, involved parties).
- **Image Processing:** Automatically handles image uploads, resizing, and positioning within the document.
- **Template Engine:** Injects data into a `.docx` template, ensuring 100% visual consistency across all company reports.
- **Output:** Generates ready-to-print/sign Word documents instantly.

### 2. Alert System
- Quick generation of visual alerts for fleet communication.
- Standardized layout for operational warnings.

## 🛠️ Tech Stack
- **Frontend:** JavaScript (ES6+), CSS3, HTML5.
- **Backend:** Node.js, Express.
- **Document Processing:** `docx` library (for programmatic Word generation), `multer` (file handling).
- **Architecture:** Modular Monorepo structure containing multiple sub-applications.

## 💡 Impact
- **Efficiency:** Reduced report creation time by approximately 70% (from ~20min to ~5min per report).
- **Standardization:** Eliminated formatting errors and inconsistencies in official documentation.
- **Usability:** Simplified a complex workflow into an intuitive UI accessible to non-technical staff.

---
*Developed by David Bitner.*
