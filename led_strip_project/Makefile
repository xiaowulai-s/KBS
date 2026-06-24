# ============================================================================
# Makefile for LED Strip Verilog Project
# ============================================================================
# Usage:
#   make simulate   - Run behavioral simulation
#   make synth      - Run synthesis (requires Vivado)
#   make clean      - Clean generated files
# ============================================================================

TOOL_VIVADO := vivado
TOOL_MODELSIM := vsim
RTL_DIR := rtl
SIM_DIR := sim
CONSTRAINTS_DIR := constraints

# Verilog source files
RTL_FILES := $(wildcard $(RTL_DIR)/*.v)
SIM_FILES := $(SIM_DIR)/tb_led_strip_top.v

# Output files
WAVE_FILE := $(SIM_DIR)/led_strip.vcd

# ============================================================================
# Targets
# ============================================================================

.PHONY: all simulate synth clean

all: simulate

simulate: $(WAVE_FILE)
	@echo "Simulation complete. Waveform saved to $(WAVE_FILE)"

$(WAVE_FILE): $(SIM_FILES) $(RTL_FILES)
	@echo "Starting simulation..."
	# Compile and run with Icarus Verilog
	iverilog -o sim_out $(SIM_FILES) $(RTL_FILES)
	vvp sim_out
	@rm -f sim_out

synth:
	@echo "Running Vivado synthesis..."
	$(TOOL_VIVADO) -mode batch -source scripts/synth.tcl

clean:
	@echo "Cleaning generated files..."
	rm -f $(WAVE_FILE) sim_out
	rm -rf *.log *.jou *.cache *.runs *.srcs *.hw *.ws
