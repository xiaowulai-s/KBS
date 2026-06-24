//------------------------------------------------------------------------------
// Module Name  : counter_div
// Description: 50MHz to 1Hz clock divider (~50 million cycles)
// Target     : Xilinx Artix-7
//------------------------------------------------------------------------------

module counter_div (
    input  wire      clk,       // 50MHz system clock
    input  wire      rst_n,     // Active-low reset
    output reg       slow_clk_out // ~1Hz output
);

    // Counter width for 50MHz to 1Hz
    // Half period = 25,000,000 counts (each count = 20ns)
    parameter COUNT_MAX = 25000000;

    reg [24:0] counter;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            counter <= 25'd0;
            slow_clk_out <= 1'b0;
        end else if (counter >= COUNT_MAX - 1'b1) begin
            counter <= 25'd0;
            slow_clk_out <= ~slow_clk_out;
        end else begin
            counter <= counter + 1'b1;
        end
    end

endmodule
