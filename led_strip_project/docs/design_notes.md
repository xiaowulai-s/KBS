# Design Notes - LED Strip Project

## Overview
This project implements an 8-bit LED sequencer using Verilog for Xilinx Artix-7 FPGAs.

## Module Hierarchy
```
led_strip_top
├── counter_div    (50MHz -> 1Hz clock divider)
└── led_seq_ctrl   (Sequential LED control)
```

## Design Details

### counter_div
- **Purpose**: Divide 50MHz system clock to ~1Hz for visible LED transitions
- **Method**: Up-counter reaching 25,000,000 before toggling output
- **Reset**: Synchronous low reset on `rst_n`

### led_seq_ctrl
- **Purpose**: Rotate LED pattern bit-by-one-clock-cycle
- **Method**: Shift register with feedback
- **Reset**: Initializes to LED0 ON

### led_strip_top
- **Purpose**: Top-level integration
- **Connections**: External ports to internal instances

## Simulation
- **Tool**: ModelSim / GTKWave
- **Output**: VCD waveform file
- **Duration**: 500,000ns (covers multiple LED states)

## Future Enhancements
- Bidirectional rotation mode
- Speed selection via push buttons
- Pattern storage (shift register chain)
- Audio feedback integration

---

Last Updated: 2026-06-23
Version: v1.0
