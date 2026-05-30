---
case_id: case-002
slug: petg-stringing-hotend-temp
title: PETG stringing caused by excessive nozzle temperature and wet filament
defect_category: stringing
tags: ["petg", "temperature", "retraction", "drying"]
cover_image: cover.jpg
printer_model: Creality K1C
nozzle_diameter: 0.4
filament_brand: Generic PETG
filament_material: PETG
filament_color: Black
slicer_name: OrcaSlicer
slicer_version: 2.2
profile_source: manual
symptom_parameters: {"nozzle_temperature": 255, "retraction_length": 0.8, "retraction_speed": 35}
solution_parameters: {"nozzle_temperature": 242, "retraction_length": 1.1, "dry_filament": true}
root_cause_analysis: The nozzle temperature was too high for the material state and the filament had absorbed moisture, which increased ooze during travel.
solution_summary: Lower the hotend temperature, slightly increase retraction, and dry the filament before further tuning.
source_url: https://example.com/fdm/case-002
source_platform: reddit
source_author: petg_troubleshooter
source_question: My PETG keeps leaving strings across every gap. What should I change first?
source_answer: Drop nozzle temperature, dry the spool, and only then fine-tune retraction because wet PETG will keep oozing.
license_note: Summary written from a public troubleshooting thread with source attribution.
collected_by: codex
review_status: reviewed
---

This case is useful for preventing the generic advice loop of only changing speed or flow. It highlights that stringing can be dominated by material condition and temperature before fine slicer tuning becomes effective.
