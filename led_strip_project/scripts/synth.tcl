# ============================================================================
# Vivado Batch Script: Run Full Flow for LED Strip Project
# ============================================================================
# Usage in Vivado Tcl Console:
#   source scripts/synth.tcl
# ============================================================================

# -----------------------------------------------------------------------
# Open Project
# -----------------------------------------------------------------------
open_project ./led_strip_project.xpr

# -----------------------------------------------------------------------
# Run Synthesis
# -----------------------------------------------------------------------
launch_runs synthesis -jobs 4
wait_on_run synthesis

puts "=== Synthesis Complete ==="

# -----------------------------------------------------------------------
# Run Implementation
# -----------------------------------------------------------------------
launch_runs impl_1 -to_step route_design -jobs 4
wait_on_run impl_1

puts "=== Implementation Complete ==="

# -----------------------------------------------------------------------
# Generate Bitstream
# -----------------------------------------------------------------------
open_run [get_runs impl_1]
launch_runs generate_bitstream -to_step write_bitstream -jobs 4
wait_on_run generate_bitstream

puts "=== Bitstream Generated ==="
puts "Output file: led_strip_project.runs/impl_1/led_strip_project.bit"
