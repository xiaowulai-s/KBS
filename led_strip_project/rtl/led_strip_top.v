//------------------------------------------------------------------------------
// Module Name  : led_strip_top
// Description: Top module for LED strip (流水灯) project
// Target     : Xilinx Artix-7 (XC7A35T)
// Author     : Agnes
// Date       : 2026-06-23
//------------------------------------------------------------------------------

module led_strip_top (
    input  wire             clk,        // 50MHz system clock
    input  wire             btn_rst_n,  // Active-low reset button
    output reg  [7:0]       led         // 8-bit LED output
);

    //--------------------------------------------------------------------------
    // Wire declarations
    //--------------------------------------------------------------------------
    wire slow_clk;  // 1Hz divided clock

    //--------------------------------------------------------------------------
    // Instance: Clock Divider
    //--------------------------------------------------------------------------
    counter_div u_counter_div (
        .clk    (clk),
        .rst_n  (btn_rst_n),
        .slow_clk_out (slow_clk)
    );

    //--------------------------------------------------------------------------
    // Instance: LED Sequencer
    //--------------------------------------------------------------------------
    led_seq_ctrl u_led_seq_ctrl (
        .clk    (slow_clk),
        .rst_n  (btn_rst_n),
        .led    (led)
    );

endmodule
