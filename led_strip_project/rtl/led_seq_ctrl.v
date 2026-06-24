//------------------------------------------------------------------------------
// Module Name  : led_seq_ctrl
// Description: Controls 8 LEDs to sequence one by one
// Target     : Xilinx Artix-7
//------------------------------------------------------------------------------

module led_seq_ctrl (
    input  wire         clk,      // 1Hz clock from divider
    input  wire         rst_n,    // Active-low reset
    output reg  [7:0]   led       // 8-bit LED output
);

    reg [2:0] state;

    // State encoding: 3 bits for 8 states
    // state 0: led = 8'b00000001 (LED0 ON)
    // state 1: led = 8'b00000010 (LED1 ON)
    // state 2: led = 8'b00000100 (LED2 ON)
    // ...
    // state 7: led = 8'b10000000 (LED7 ON)

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= 3'd0;
            led   <= 8'b00000001;
        end else begin
            state <= state + 1'b1;
            led   <= {1'b0, led[7:1]} | {led[0], 7'b0};
        end
    end

endmodule
