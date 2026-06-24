# ============================================================================
# Vivado Tcl Script: Create and Setup LED Strip Project
# ============================================================================
# Usage in Vivado Tcl Console:
#   source scripts/create_project.tcl
# ============================================================================

# -----------------------------------------------------------------------
# Project Configuration
# -----------------------------------------------------------------------
set proj_name "led_strip_project"
set proj_dir "./${proj_name}"
set part_num "xc7a35ticsg324-1L"

# -----------------------------------------------------------------------
# Create Project
# -----------------------------------------------------------------------
create_project ${proj_name} ${proj_dir} -part ${part_num}

# -----------------------------------------------------------------------
# Add Source Files
# -----------------------------------------------------------------------
add_files -scan_for_related {
    rtl/led_strip_top.v
    rtl/counter_div.v
    rtl/led_seq_ctrl.v
}

# -----------------------------------------------------------------------
# Add Constraint Files
# -----------------------------------------------------------------------
add_files -scan_for_related {
    constraints/pins.xdc
}

# -----------------------------------------------------------------------
# Set Top Module
# -----------------------------------------------------------------------
set_property top led_strip_top [current_fileset]

# -----------------------------------------------------------------------
# Run Synthesis
# -----------------------------------------------------------------------
launch_synthesis

puts "=== Project Created Successfully ==="
puts "Source files added: ${proj_dir}/rtl/"
puts "Constraint files added: ${proj_dir}/constraints/"
puts "Top module: led_strip_top"
puts "Part: ${part_num}"
