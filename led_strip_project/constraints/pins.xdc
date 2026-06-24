# ============================================================================
# Constraint File for LED Strip Project (Xilinx Artix-7)
# ============================================================================
# Target Board: Basys 3 / Zybo / Custom Carrier
# FPGA Part:    xc7a35ticsg324-1L
# ============================================================================

# ---------------------------------------------------------------
# System Clock: 50MHz
# ---------------------------------------------------------------
set_property PACKAGE_PIN E3   [get_ports clk]
set_property IOSTANDARD LVCMOS33 [get_ports clk]
create_clock -period 20.000 [get_ports clk]

# ---------------------------------------------------------------
# LED Outputs: 8-bit LED bank
# ---------------------------------------------------------------
set_property PACKAGE_PIN G15 [get_ports {led[0]}]
set_property IOSTANDARD LVCMOS33 [get_ports {led[0]}]

set_property PACKAGE_PIN H15 [get_ports {led[1]}]
set_property IOSTANDARD LVCMOS33 [get_ports {led[1]}]

set_property PACKAGE_PIN J15 [get_ports {led[2]}]
set_property IOSTANDARD LVCMOS33 [get_ports {led[2]}]

set_property PACKAGE_PIN L15 [get_ports {led[3]}]
set_property IOSTANDARD LVCMOS33 [get_ports {led[3]}]

set_property PACKAGE_PIN M14 [get_ports {led[4]}]
set_property IOSTANDARD LVCMOS33 [get_ports {led[4]}]

set_property PACKAGE_PIN N14 [get_ports {led[5]}]
set_property IOSTANDARD LVCMOS33 [get_ports {led[5]}]

set_property PACKAGE_PIN P14 [get_ports {led[6]}]
set_property IOSTANDARD LVCMOS33 [get_ports {led[6]}]

set_property PACKAGE_PIN R15 [get_ports {led[7]}]
set_property IOSTANDARD LVCMOS33 [get_ports {led[7]}]

# ---------------------------------------------------------------
# Reset Button: Active-low push button
# ---------------------------------------------------------------
set_property PACKAGE_PIN T15 [get_ports btn_rst_n]
set_property IOSTANDARD LVCMOS33 [get_ports btn_rst_n]

# ============================================================================
# NOTES:
# - Replace PACKAGE_PIN values with your actual board's GPIO pin assignments.
# - Consult your board's schematic for exact pin numbers.
# - IOSTANDARD LVCMOS33 is typical for 3.3V FPGAs.
# ============================================================================
