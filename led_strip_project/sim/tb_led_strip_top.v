//------------------------------------------------------------------------------
// Testbench for LED Strip Project
// Description: Behavioral simulation stimulus
//------------------------------------------------------------------------------

`timescale 1ns / 1ps

module tb_led_strip_top();

    // Signal declarations
    reg clk;
    reg btn_rst_n;
    wire [7:0] led;

    // Instantiate DUT
    led_strip_top dut (
        .clk      (clk),
        .btn_rst_n(btn_rst_n),
        .led      (led)
    );

    // Clock generation: 50MHz -> period = 20ns
    initial begin
        clk = 0;
        forever #10 clk = ~clk;
    end

    // Reset sequence
    initial begin
        btn_rst_n = 0;
        #100;          // Hold reset for 100ns
        btn_rst_n = 1; // Release reset

        // Wait for a few LED cycles
        #500000;
        $finish;
    end

    // Monitor output
    initial begin
        $monitor("Time=%t | Reset=%b | LED=%b", $time, btn_rst_n, led);
        $dumpfile("led_strip.vcd");
        $dumpvars(0, tb_led_strip_top);
    end

endmodule
