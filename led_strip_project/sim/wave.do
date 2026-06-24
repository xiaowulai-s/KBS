onerror {resume}
quietly WaveActivateNextPane {} 0

add wave -noupdate /tb_led_strip_top/clk
add wave -noupdate /tb_led_strip_top/btn_rst_n
add wave -noupdate /tb_led_strip_top/led

TreeUpdate [SetDefaultTree]
WaveRestoreCursors {{Cursor 1} {0 ps} 0}
quietly wave cursor active 1
configure wave -namecolwidth 150
configure wave -valuecolwidth 100
configure wave -justifyvalue left
configure wave -signalnamewidth 1
configure wave -terminallength 40
configure wave -terminalwidth 40
configure wave -pnoborder true
onyou