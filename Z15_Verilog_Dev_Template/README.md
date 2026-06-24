# Z15 ZYNQ7015 Verilog 开发工程模板

> **目标开发板**：正点原子 Z15 (XC7Z015CLG485-2)
> **Vivado 版本**：≥ 2020.2
> **开发语言**：Verilog

---

## 一、工程目录结构

```
z15_verilog_template/
├── z15_project.xpr                  # Vivado 工程文件
├── z15_project.ip_user_files/       # IP 用户文件 (自动生成)
├── block_design/
│   ├── sys_block.bd                 # Block Design 文件
│   ├── sys_block_wrapper.v          # BD 顶层包装 (自动生成)
│   └── gui/                         # BD 图形缓存 (自动生成)
├── src/
│   ├── top.v                        # 顶层模块 (用户编写)
│   ├── led_blink.v                  # LED 闪烁模块
│   ├── key_scan.v                   # 按键扫描模块
│   ├── uart_tx.v                    # UART 发送模块
│   ├── uart_rx.v                    # UART 接收模块
│   ├── axi_gpio_ctrl.v              # AXI GPIO 控制模块
│   ├── pwm_generator.v              # PWM 发生器
│   ├── timer_counter.v              # 定时器计数器
│   └── i2c_master.v                 # I2C 主控制器
├── sim/
│   ├── tb_led_blink.v               # LED 模块测试激励
│   ├── tb_top.v                     # 顶层模块测试激励
│   └── tb_uart.v                    # UART 测试激励
├── constraints/
│   ├── z15_pins.xdc                 # 引脚约束
│   └── z15_timing.xdc              # 时序约束
├── export/
│   └── hardware/
│       └── z15_template.xsa         # 导出硬件定义
├── scripts/
│   ├── build_project.tcl            # 工程创建脚本
│   └── run_all_tests.tcl            # 自动化运行脚本
├── docs/
│   └── Z15_MIO_Map.md              # MIO 引脚映射表
└── README.md
```

---

## 二、核心 Verilog 模块

### 2.1 顶层模块 `src/top.v`

```verilog
`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////
// Module Name : top
// Description : Z15 ZYNQ7015 顶层模块
//              PS 端通过 AXI 总线连接 PL 端外设
//              本模块实例化所有 PL 端功能模块
//////////////////////////////////////////////////////////////////////////

module top #(
    parameter CLK_PERIOD_NS = 10.0    // PL 时钟周期 10ns (100MHz)
) (
    // ========== 时钟与复位 ==========
    input  wire             clk_50mhz       , // 板载 50MHz 时钟
    input  wire             sys_rst_n       , // 系统复位 (低有效)
    
    // ========== PS 端 LED 控制 (AXI GPIO) ==========
    output  wire [7:0]      ps_led          , // PS 端 LED (MIO 引出)
    
    // ========== PL 端 LED 输出 ==========
    output  wire [7:0]      pl_led          , // PL 端 LED
    
    // ========== PL 端按键输入 ==========
    input  wire [3:0]       pl_key          , // PL 端按键
    
    // ========== UART (PS 端 MIO 12/13) ==========
    input  wire             uart_rx         , // UART 接收
    output  wire            uart_tx         , // UART 发送
    
    // ========== Ethernet (PS 端 MIO 0-17) ==========
    // 无需在 PL 端声明
    
    // ========== QSPI Flash ==========
    // 无需在 PL 端声明
    
    // ========== SD Card ==========
    // 无需在 PL 端声明
    
    // ========== AXI 总线接口 (由 Block Design 自动生成) ==========
    input  wire             s_axi_aclk        , // AXI 时钟
    input  wire             s_axi_aresetn     , // AXI 复位
    
    // ========== 中断信号 ==========
    output  wire            interrupt_out     // PL → PS 中断
);

    // ========== 内部信号 ==========
    wire                    clk_pl;               // PL 端时钟 (由时钟管理器分频)
    wire                    clk_100mhz;           // 100MHz 时钟
    wire                    clk_50mhz_div;        // 50MHz 分频时钟
    wire                    locked;               // 时钟锁存状态
    
    wire [31:0]             led_data;             // LED 数据 (来自 AXI GPIO)
    wire [31:0]             key_data;             // 按键数据
    
    wire [7:0]              blink_led;            // LED 闪烁结果
    wire [7:0]              control_led;          // LED 控制结果
    wire [7:0]              mix_led;              // 混合 LED 输出
    
    wire                    tx_done;              // UART 发送完成
    wire [7:0]              rx_data;              // UART 接收数据
    wire                    tx_en;                // UART 发送使能
    wire [7:0]              tx_data;              // UART 发送数据
    wire                    rx_en;                // UART 接收使能
    
    wire                    pwm_out;              // PWM 输出
    wire                    timer_tick;           // 定时器节拍
    
    wire                    i2c_scl;              // I2C 时钟
    wire                    i2c_sda;              // I2C 数据
    
    wire                    key_flag;             // 按键触发标志
    wire [3:0]              key_code;             // 按键编码

    // ========== 时钟管理 ==========
    clk_wizard_inst clk_wizard_inst (
        .clk_out1     (clk_pl),                    // 100MHz 输出
        .clk_out2     (clk_100mhz),
        .clk_out3     (clk_50mhz_div),
        .locked       (locked),
        .clk_in1      (clk_50mhz),                 // 50MHz 输入
        .reset        (~sys_rst_n),                 // 复位 (高有效)
        .lock         (locked)
    );

    // ========== AXI GPIO 读 (PS → PL 控制 LED) ==========
    axi_gpio_ps_led axi_gpio_ps_led_inst (
        .clk            (clk_pl),
        .rst_n          (sys_rst_n),
        .gpio_data      (led_data[7:0]),
        .control_led    (control_led)
    );

    // ========== LED 闪烁模块 ==========
    led_blink led_blink_inst (
        .clk            (clk_pl),
        .rst_n          (sys_rst_n),
        .en             (1'b1),                     // 始终使能
        .blink_led      (blink_led)
    );

    // ========== 按键扫描模块 ==========
    key_scan key_scan_inst (
        .clk            (clk_pl),
        .rst_n          (sys_rst_n),
        .keys_in        (pl_key),
        .key_flag       (key_flag),
        .key_code       (key_code),
        .debounce_en    (1'b1)                      // 消抖使能
    );

    // ========== UART 发送模块 ==========
    uart_tx uart_tx_inst (
        .clk            (clk_pl),
        .rst_n          (sys_rst_n),
        .tx_start       (tx_en),
        .tx_data        (tx_data),
        .tx_done        (tx_done),
        .uart_tx        (uart_tx)
    );

    // ========== UART 接收模块 ==========
    uart_rx uart_rx_inst (
        .clk            (clk_pl),
        .rst_n          (sys_rst_n),
        .uart_rx        (uart_rx),
        .rx_data        (rx_data),
        .rx_valid       (rx_en),
        .rx_done        ()
    );

    // ========== PWM 发生器 ==========
    pwm_generator pwm_inst (
        .clk            (clk_pl),
        .rst_n          (sys_rst_n),
        .duty_cycle     (8'h80),                    // 50% 占空比
        .pwm_out        (pwm_out)
    );

    // ========== 定时器计数器 ==========
    timer_counter timer_inst (
        .clk            (clk_pl),
        .rst_n          (sys_rst_n),
        .load_value     (32'h000F_FFFF),
        .timer_tick     (timer_tick),
        .count_value    ()
    );

    // ========== I2C 主控制器 ==========
    i2c_master i2c_inst (
        .clk            (clk_pl),
        .rst_n          (sys_rst_n),
        .i2c_scl        (i2c_scl),
        .i2c_sda        (i2c_sda),
        .start          (1'b0),
        .write_addr     (8'h40),
        .write_data     (8'h00),
        .read_addr      (8'h41),
        .read_data      (),
        .busy           ()
    );

    // ========== LED 混合输出 ==========
    assign pl_led = mix_led;
    assign mix_led = blink_led | control_led;

    // ========== 中断输出 ==========
    assign interrupt_out = key_flag | timer_tick;

    // ========== 常量赋值 ==========
    assign ps_led     = 8'hFF;  // PS 端 LED 常亮 (可根据需要修改)
    assign tx_data    = 8'h55;  // 默认发送数据 (0x55)
    assign tx_en      = timer_tick;  // 定时器触发发送
    assign pwm_out    = 1'b0;    // PWM 输出默认关闭

endmodule
```

---

### 2.2 LED 闪烁模块 `src/led_blink.v`

```verilog
//////////////////////////////////////////////////////////////////////////
// Module Name : led_blink
// Description : LED 闪烁模块, 支持多个不同频率的 LED 闪烁
//              可用于系统运行指示
//////////////////////////////////////////////////////////////////////////

module led_blink #(
    parameter CLK_FREQ      = 100,       // 时钟频率 (MHz)
    parameter BLINK_1_HZ    = 1,         // LED[0]: 1Hz (慢闪)
    parameter BLINK_2_HZ    = 2,         // LED[1]: 2Hz (中闪)
    parameter BLINK_3_HZ    = 4,         // LED[2]: 4Hz (快闪)
    parameter BLINK_4_HZ    = 8          // LED[3]: 8Hz (极快)
) (
    input   wire            clk           ,
    input   wire            rst_n         ,
    input   wire            en            ,
    output  reg  [7:0]      blink_led
);

    // ========== 计数器参数 ==========
    localparam CNT_1HZ     = CLK_FREQ * 1_000_000 / (BLINK_1_HZ * 2) - 1;
    localparam CNT_2HZ     = CLK_FREQ * 1_000_000 / (BLINK_2_HZ * 2) - 1;
    localparam CNT_4HZ     = CLK_FREQ * 1_000_000 / (BLINK_3_HZ * 2) - 1;
    localparam CNT_8HZ     = CLK_FREQ * 1_000_000 / (BLINK_4_HZ * 2) - 1;

    // ========== 计数器 ==========
    reg  [31:0] cnt_1hz;
    reg         toggle_1hz;
    
    reg  [31:0] cnt_2hz;
    reg         toggle_2hz;
    
    reg  [31:0] cnt_4hz;
    reg         toggle_4hz;
    
    reg  [31:0] cnt_8hz;
    reg         toggle_8hz;

    // 1Hz 计数器
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            cnt_1hz    <= 32'd0;
            toggle_1hz <= 1'b0;
        end else if (en) begin
            if (cnt_1hz < CNT_1HZ) begin
                cnt_1hz <= cnt_1hz + 1'b1;
            end else begin
                cnt_1hz    <= 32'd0;
                toggle_1hz <= ~toggle_1hz;
            end
        end
    end

    // 2Hz 计数器
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            cnt_2hz    <= 32'd0;
            toggle_2hz <= 1'b0;
        end else if (en) begin
            if (cnt_2hz < CNT_2HZ) begin
                cnt_2hz <= cnt_2hz + 1'b1;
            end else begin
                cnt_2hz    <= 32'd0;
                toggle_2hz <= ~toggle_2hz;
            end
        end
    end

    // 4Hz 计数器
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            cnt_4hz    <= 32'd0;
            toggle_4hz <= 1'b0;
        end else if (en) begin
            if (cnt_4hz < CNT_4HZ) begin
                cnt_4hz <= cnt_4hz + 1'b1;
            end else begin
                cnt_4hz    <= 32'd0;
                toggle_4hz <= ~toggle_4hz;
            end
        end
    end

    // 8Hz 计数器
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            cnt_8hz    <= 32'd0;
            toggle_8hz <= 1'b0;
        end else if (en) begin
            if (cnt_8hz < CNT_8HZ) begin
                cnt_8hz <= cnt_8hz + 1'b1;
            end else begin
                cnt_8hz    <= 32'd0;
                toggle_8hz <= ~toggle_8hz;
            end
        end
    end

    // LED 输出
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            blink_led <= 8'hFF;
        end else begin
            blink_led <= {
                4'b1111,               // LED[7:4]: 常亮
                toggle_8hz,            // LED[3]: 8Hz
                toggle_4hz,            // LED[2]: 4Hz
                toggle_2hz,            // LED[1]: 2Hz
                toggle_1hz             // LED[0]: 1Hz
            };
        end
    end

endmodule
```

---

### 2.3 按键扫描模块 `src/key_scan.v`

```verilog
//////////////////////////////////////////////////////////////////////////
// Module Name : key_scan
// Description : 按键扫描 + 消抖模块
//              支持 4 路按键, 消抖时间 ~20ms
//////////////////////////////////////////////////////////////////////////

module key_scan #(
    parameter CLK_FREQ      = 100,       // 时钟频率 (MHz)
    parameter DEBOUNCE_MS   = 20         // 消抖时间 (ms)
) (
    input   wire            clk           ,
    input   wire            rst_n         ,
    input   wire [3:0]      keys_in       ,
    output  reg             key_flag      ,
    output  reg  [3:0]      key_code      ,
    input   wire            debounce_en
);

    // ========== 消抖计数器参数 ==========
    localparam DEBOUNCE_CNT = CLK_FREQ * DEBOUNCE_MS;  // 20ms 计数值

    reg  [3:0]      keys_d1;           // 一级延迟 (同步器)
    reg  [3:0]      keys_d2;           // 二级延迟
    reg  [31:0]     debounce_cnt;
    reg             debounce_flag;
    reg  [3:0]      stable_keys;
    reg  [3:0]      last_stable;
    reg             press_detected;

    // ========== 同步器 (防亚稳态) ==========
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            keys_d1 <= 4'b1111;
            keys_d2 <= 4'b1111;
        end else begin
            keys_d1 <= keys_in;
            keys_d2 <= keys_d1;
        end
    end

    // ========== 边沿检测 (下降沿 = 按键按下) ==========
    wire [3:0] falling_edge = (~keys_d2) & last_stable;

    // ========== 消抖逻辑 ==========
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            debounce_cnt  <= 32'd0;
            stable_keys   <= 4'b1111;
            last_stable   <= 4'b1111;
            debounce_flag <= 1'b0;
        end else if (debounce_en) begin
            if (falling_edge != 4'b0) begin
                debounce_cnt <= debounce_cnt + 1'b1;
                if (debounce_cnt >= DEBOUNCE_CNT - 1) begin
                    debounce_cnt  <= 32'd0;
                    stable_keys   <= keys_d2;
                    last_stable   <= keys_d2;
                    debounce_flag <= 1'b1;
                end
            end else begin
                debounce_cnt <= 32'd0;
            end
        end
    end

    // ========== 按键编码 ==========
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            key_code  <= 4'b0000;
            key_flag  <= 1'b0;
            press_detected <= 1'b0;
        end else begin
            if (debounce_flag) begin
                case (stable_keys)
                    4'b1110: begin key_code <= 4'b0001; press_detected <= 1'b1; end
                    4'b1101: begin key_code <= 4'b0010; press_detected <= 1'b1; end
                    4'b1011: begin key_code <= 4'b0100; press_detected <= 1'b1; end
                    4'b0111: begin key_code <= 4'b1000; press_detected <= 1'b1; end
                    default: begin key_code <= 4'b0000; press_detected <= 1'b0; end
                endcase
            end else begin
                key_code  <= 4'b0000;
                press_detected <= 1'b0;
            end
        end
    end

    // ========== 按键触发标志 ==========
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            key_flag <= 1'b0;
        end else begin
            key_flag <= press_detected;
        end
    end

endmodule
```

---

### 2.4 UART 发送模块 `src/uart_tx.v`

```verilog
//////////////////////////////////////////////////////////////////////////
// Module Name : uart_tx
// Description : 异步 UART 发送模块
//              波特率: 115200, 8N1
//              支持起始位、数据位、停止位
//////////////////////////////////////////////////////////////////////////

module uart_tx #(
    parameter BAUD_RATE       = 115200,
    parameter CLK_FREQ        = 100_000_000,  // 100MHz
    parameter DATA_WIDTH      = 8
) (
    input   wire            clk           ,
    input   wire            rst_n         ,
    input   wire            tx_start      ,
    input   wire [7:0]      tx_data       ,
    output  reg             tx_done       ,
    output  reg             uart_tx
);

    // ========== 波特率分频 ==========
    localparam BAUD_DIVISOR = CLK_FREQ / BAUD_RATE;  // 868

    reg [15:0]    baud_cnt;
    reg [3:0]     bit_cnt;
    reg [7:0]     data_reg;
    reg [3:0]     state;
    
    localparam IDLE       = 4'd0;
    localparam START_BIT  = 4'd1;
    localparam DATA_BITS  = 4'd2;
    localparam STOP_BIT   = 4'd3;

    // ========== 发送状态机 ==========
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state      <= IDLE;
            baud_cnt   <= 16'd0;
            bit_cnt    <= 4'd0;
            data_reg   <= 8'd0;
            uart_tx    <= 1'b1;
            tx_done    <= 1'b0;
        end else begin
            case (state)
                IDLE: begin
                    tx_done  <= 1'b0;
                    uart_tx  <= 1'b1;
                    if (tx_start) begin
                        data_reg  <= tx_data;
                        state     <= START_BIT;
                        baud_cnt  <= 16'd0;
                    end
                end
                
                START_BIT: begin
                    if (baud_cnt < BAUD_DIVISOR - 1) begin
                        baud_cnt <= baud_cnt + 1'b1;
                    end else begin
                        baud_cnt <= 16'd0;
                        uart_tx  <= 1'b0;  // 拉低起始位
                        state    <= DATA_BITS;
                        bit_cnt  <= 4'd0;
                    end
                end
                
                DATA_BITS: begin
                    if (baud_cnt < BAUD_DIVISOR - 1) begin
                        baud_cnt <= baud_cnt + 1'b1;
                    end else begin
                        baud_cnt <= 16'd0;
                        uart_tx  <= data_reg[bit_cnt];  // 发送数据位 (LSB first)
                        bit_cnt  <= bit_cnt + 1'b1;
                        if (bit_cnt == DATA_WIDTH - 1) begin
                            state <= STOP_BIT;
                        end
                    end
                end
                
                STOP_BIT: begin
                    if (baud_cnt < BAUD_DIVISOR - 1) begin
                        baud_cnt <= baud_cnt + 1'b1;
                    end else begin
                        baud_cnt <= 16'd0;
                        uart_tx  <= 1'b1;  // 释放总线
                        tx_done  <= 1'b1;
                        state    <= IDLE;
                    end
                end
                
                default: state <= IDLE;
            endcase
        end
    end

endmodule
```

---

### 2.5 UART 接收模块 `src/uart_rx.v`

```verilog
//////////////////////////////////////////////////////////////////////////
// Module Name : uart_rx
// Description : 异步 UART 接收模块
//              波特率: 115200, 8N1
//////////////////////////////////////////////////////////////////////////

module uart_rx #(
    parameter BAUD_RATE       = 115200,
    parameter CLK_FREQ        = 100_000_000,
    parameter DATA_WIDTH      = 8
) (
    input   wire            clk           ,
    input   wire            rst_n         ,
    input   wire            uart_rx       ,
    output  reg  [7:0]      rx_data       ,
    output  reg             rx_valid      ,
    output  reg             rx_done
);

    localparam BAUD_DIVISOR = CLK_FREQ / BAUD_RATE;

    reg [15:0]    baud_cnt;
    reg [3:0]     bit_cnt;
    reg [7:0]     data_reg;
    reg [3:0]     state;
    reg           rx_d1;
    reg           rx_d2;
    
    localparam IDLE       = 4'd0;
    localparam START_DET  = 4'd1;
    localparam SAMPLING   = 4'd2;
    localparam STOP_CHECK = 4'd3;

    // ========== 边沿检测 (下降沿 = 起始位) ==========
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            rx_d1 <= 1'b1;
            rx_d2 <= 1'b1;
        end else begin
            rx_d1 <= uart_rx;
            rx_d2 <= rx_d1;
        end
    end

    wire start_edge = rx_d2 & ~uart_rx;  // 下降沿检测

    // ========== 接收状态机 ==========
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state      <= IDLE;
            baud_cnt   <= 16'd0;
            bit_cnt    <= 4'd0;
            data_reg   <= 8'd0;
            rx_valid   <= 1'b0;
            rx_done    <= 1'b0;
        end else begin
            case (state)
                IDLE: begin
                    rx_valid  <= 1'b0;
                    rx_done   <= 1'b0;
                    if (start_edge) begin
                        state     <= START_DET;
                        baud_cnt  <= 16'd0;
                    end
                end
                
                START_DET: begin
                    if (baud_cnt < BAUD_DIVISOR - 1) begin
                        baud_cnt <= baud_cnt + 1'b1;
                    end else begin
                        baud_cnt <= 16'd0;
                        state    <= SAMPLING;
                        bit_cnt  <= 4'd0;
                    end
                end
                
                SAMPLING: begin
                    if (baud_cnt < BAUD_DIVISOR - 1) begin
                        baud_cnt <= baud_cnt + 1'b1;
                    end else begin
                        baud_cnt <= 16'd0;
                        data_reg[bit_cnt] <= uart_rx;  // 采样数据位
                        bit_cnt  <= bit_cnt + 1'b1;
                        if (bit_cnt == DATA_WIDTH - 1) begin
                            state <= STOP_CHECK;
                        end
                    end
                end
                
                STOP_CHECK: begin
                    if (baud_cnt < BAUD_DIVISOR - 1) begin
                        baud_cnt <= baud_cnt + 1'b1;
                    end else begin
                        baud_cnt  <= 16'd0;
                        rx_data   <= data_reg;
                        rx_valid  <= 1'b1;
                        rx_done   <= 1'b1;
                        state     <= IDLE;
                    end
                end
                
                default: state <= IDLE;
            endcase
        end
    end

endmodule
```

---

### 2.6 PWM 发生器 `src/pwm_generator.v`

```verilog
//////////////////////////////////////////////////////////////////////////
// Module Name : pwm_generator
// Description : PWM 信号发生器
//              支持动态占空比调节
//////////////////////////////////////////////////////////////////////////

module pwm_generator #(
    parameter PWM_FREQ_HZ   = 20_000,      // PWM 频率 20kHz
    parameter CLK_FREQ      = 100_000_000,  // 100MHz
    parameter PRESCALER     = 100           // 预分频
) (
    input   wire            clk           ,
    input   wire            rst_n         ,
    input   wire [7:0]      duty_cycle    , // 占空比 0-255
    output  reg             pwm_out
);

    localparam PWM_COUNT_MAX = (CLK_FREQ / PWM_FREQ_HZ / PRESCALER) - 1;
    
    reg [31:0]    prescaler_cnt;
    reg [15:0]    pwm_cnt;
    reg           prescaler_en;

    // ========== 预分频计数器 ==========
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            prescaler_cnt  <= 32'd0;
            prescaler_en   <= 1'b0;
        end else begin
            if (prescaler_cnt < PRESCALER - 1) begin
                prescaler_cnt <= prescaler_cnt + 1'b1;
                prescaler_en  <= 1'b0;
            end else begin
                prescaler_cnt <= 32'd0;
                prescaler_en  <= 1'b1;
            end
        end
    end

    // ========== PWM 计数器 ==========
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            pwm_cnt    <= 16'd0;
            pwm_out    <= 1'b0;
        end else if (prescaler_en) begin
            if (pwm_cnt < PWM_COUNT_MAX) begin
                pwm_cnt <= pwm_cnt + 1'b1;
            end else begin
                pwm_cnt <= 16'd0;
            end
            
            // 比较占空比
            pwm_out <= (pwm_cnt < (duty_cycle * PWM_COUNT_MAX / 255));
        end
    end

endmodule
```

---

### 2.7 定时器计数器 `src/timer_counter.v`

```verilog
//////////////////////////////////////////////////////////////////////////
// Module Name : timer_counter
// Description : 通用定时器计数器
//              支持自动重载模式
//////////////////////////////////////////////////////////////////////////

module timer_counter #(
    parameter TIMER_PERIOD_US   = 1000,     // 定时周期 (us)
    parameter CLK_FREQ          = 100_000_000
) (
    input   wire            clk           ,
    input   wire            rst_n         ,
    input   wire            load_en       ,
    input   wire [31:0]     load_value    ,
    output  reg             timer_tick    ,
    output  reg  [31:0]     count_value
);

    localparam TIMER_MAX = (CLK_FREQ * TIMER_PERIOD_US) / 1_000_000;

    reg [31:0]    cnt;

    // ========== 计数器 ==========
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            cnt        <= 32'd0;
            timer_tick <= 1'b0;
            count_value <= 32'd0;
        end else begin
            if (load_en) begin
                cnt        <= load_value;
                timer_tick <= 1'b0;
            end else if (cnt > 0) begin
                cnt        <= cnt - 1'b1;
                timer_tick <= 1'b0;
                count_value <= cnt - 1'b1;
            end else begin
                cnt        <= TIMER_MAX - 1;  // 自动重载
                timer_tick <= 1'b1;
                count_value <= 32'd0;
            end
        end
    end

endmodule
```

---

### 2.8 AXI GPIO 控制模块 `src/axi_gpio_ctrl.v`

```verilog
//////////////////////////////////////////////////////////////////////////
// Module Name : axi_gpio_ctrl
// Description : AXI GPIO 数据读取模块
//              从 PS 端 AXI GPIO 读取控制数据
//////////////////////////////////////////////////////////////////////////

module axi_gpio_ctrl #(
    parameter GPIO_WIDTH = 32
) (
    input   wire            clk           ,
    input   wire            rst_n         ,
    input   wire [31:0]     gpio_data     , // 来自 AXI GPIO IP
    output  reg  [7:0]      led_output
);

    // ========== 数据寄存器 ==========
    reg [31:0]    gpio_reg;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            gpio_reg <= 32'd0;
            led_output <= 8'hFF;
        end else begin
            gpio_reg <= gpio_data;
            // 取低 8 位控制 LED
            led_output <= gpio_reg[7:0];
        end
    end

endmodule
```

---

### 2.9 I2C 主控制器 `src/i2c_master.v`

```verilog
//////////////////////////////////////////////////////////////////////////
// Module Name : i2c_master
// Description : 简易 I2C 主控制器 (位串型)
//              支持标准 I2C 协议
//////////////////////////////////////////////////////////////////////////

module i2c_master #(
    parameter CLK_FREQ        = 100_000_000,
    parameter I2C_FREQ        = 100_000      // 100kHz 标准模式
) (
    input   wire            clk           ,
    input   wire            rst_n         ,
    inout   wire            i2c_scl       ,
    inout   wire            i2c_sda       ,
    input   wire            start         ,
    input   wire [7:0]      write_addr    ,
    input   wire [7:0]      write_data    ,
    input   wire [7:0]      read_addr     ,
    output  reg  [7:0]      read_data     ,
    output  reg             busy
);

    // I2C 时钟分频
    localparam I2C_DIV = CLK_FREQ / I2C_FREQ;
    
    reg [31:0]    div_cnt;
    reg [3:0]     state;
    reg [7:0]     shift_reg;
    reg [3:0]     bit_cnt;
    reg           scl_val;
    reg           sda_val;
    reg           sda_dir;  // 0=input, 1=output
    
    localparam IDLE       = 4'd0;
    localparam WRITE_CMD  = 4'd1;
    localparam READ_CMD   = 4'd2;
    localparam ACK        = 4'd3;
    localparam STOP       = 4'd4;

    // ========== I2C 时钟分频 ==========
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            div_cnt <= 32'd0;
        end else if (start && !busy) begin
            if (div_cnt < I2C_DIV - 1) begin
                div_cnt <= div_cnt + 1'b1;
            end else begin
                div_cnt <= 32'd0;
            end
        end
    end

    // ========== I2C 状态机 (简化版) ==========
    // 实际使用时建议参考 Xilinx AXI I2C IP 核或正点原子参考工程

    assign i2c_scl = scl_val;
    assign i2c_sda = sda_dir ? sda_val : 1'bz;

endmodule
```

---

## 三、仿真测试激励模板

### 3.1 LED 闪烁模块仿真 `sim/tb_led_blink.v`

```verilog
//////////////////////////////////////////////////////////////////////////
// Testbench for led_blink module
//////////////////////////////////////////////////////////////////////////

`timescale 1ns / 1ps

module tb_led_blink();

    // ========== 信号声明 ==========
    reg             clk;
    reg             rst_n;
    reg             en;
    wire [7:0]      blink_led;

    // ========== 实例化待测模块 ==========
    led_blink #(
        .CLK_FREQ     (100),
        .BLINK_1_HZ   (1),
        .BLINK_2_HZ   (2),
        .BLINK_3_HZ   (4),
        .BLINK_4_HZ   (8)
    ) uut (
        .clk        (clk),
        .rst_n      (rst_n),
        .en         (en),
        .blink_led  (blink_led)
    );

    // ========== 时钟生成 ==========
    initial clk = 0;
    always #5 clk = ~clk;  // 100MHz

    // ========== 测试激励 ==========
    initial begin
        // 初始化
        rst_n = 0;
        en    = 0;
        
        // 复位
        #100;
        rst_n = 1;
        
        // 使能
        #100;
        en = 1;
        
        // 等待足够时间观察闪烁
        #1000000;
        
        // 结束
        $display("Testbench completed!");
        $finish;
    end

    // ========== 波形 dumped ==========
    initial begin
        $dumpfile("led_blink.vcd");
        $dumpvars(0, tb_led_blink);
    end

endmodule
```

---

### 3.2 UART 发送仿真 `sim/tb_uart_tx.v`

```verilog
//////////////////////////////////////////////////////////////////////////
// Testbench for uart_tx module
//////////////////////////////////////////////////////////////////////////

`timescale 1ns / 1ps

module tb_uart_tx();

    reg             clk;
    reg             rst_n;
    reg             tx_start;
    reg  [7:0]      tx_data;
    wire            tx_done;
    wire            uart_tx;

    uart_tx #(
        .BAUD_RATE    (115200),
        .CLK_FREQ     (100_000_000),
        .DATA_WIDTH   (8)
    ) uut (
        .clk        (clk),
        .rst_n      (rst_n),
        .tx_start   (tx_start),
        .tx_data    (tx_data),
        .tx_done    (tx_done),
        .uart_tx    (uart_tx)
    );

    initial clk = 0;
    always #5 clk = ~clk;

    initial begin
        rst_n     = 0;
        tx_start  = 0;
        tx_data   = 8'd0;
        
        #100;
        rst_n = 1;
        
        // 发送第一个字节 0x55
        #1000;
        tx_start = 1;
        tx_data  = 8'h55;
        #200;
        tx_start = 0;
        
        // 等待发送完成
        wait(tx_done);
        
        // 发送第二个字节 0xAA
        #1000;
        tx_start = 1;
        tx_data  = 8'HAА;
        #200;
        tx_start = 0;
        
        wait(tx_done);
        
        $display("UART TX Test completed!");
        $finish;
    end

    initial begin
        $dumpfile("uart_tx.vcd");
        $dumpvars(0, tb_uart_tx);
    end

endmodule
```

---

## 四、XDC 引脚约束文件

### 4.1 完整引脚约束 `constraints/z15_pins.xdc`

```tcl
##############################################################################
# Z15 ZYNQ7015 - 正点原子开发板引脚约束
# 注意: 请以官方原理图为准核对以下引脚
##############################################################################

# ==========================================
# 1. 时钟
# ==========================================
set_property -dict {PACKAGE_PIN Y18 ; IOSTANDARD LVCMOS33} [get_ports clk_50mhz]

# ==========================================
# 2. LEDs (PL 端, 8 路)
# ==========================================
set_property -dict {PACKAGE_PIN H17 ; IOSTANDARD LVCMOS33} [get_ports {pl_led[0]}]
set_property -dict {PACKAGE_PIN J17 ; IOSTANDARD LVCMOS33} [get_ports {pl_led[1]}]
set_property -dict {PACKAGE_PIN H18 ; IOSTANDARD LVCMOS33} [get_ports {pl_led[2]}]
set_property -dict {PACKAGE_PIN J18 ; IOSTANDARD LVCMOS33} [get_ports {pl_led[3]}]
set_property -dict {PACKAGE_PIN K17 ; IOSTANDARD LVCMOS33} [get_ports {pl_led[4]}]
set_property -dict {PACKAGE_PIN K18 ; IOSTANDARD LVCMOS33} [get_ports {pl_led[5]}]
set_property -dict {PACKAGE_PIN L17 ; IOSTANDARD LVCMOS33} [get_ports {pl_led[6]}]
set_property -dict {PACKAGE_PIN L18 ; IOSTANDARD LVCMOS33} [get_ports {pl_led[7]}]

# ==========================================
# 3. 按键 (PL 端, 4 路)
# ==========================================
set_property -dict {PACKAGE_PIN M13 ; IOSTANDARD LVCMOS33} [get_ports {pl_key[0]}]
set_property -dict {PACKAGE_PIN M14 ; IOSTANDARD LVCMOS33} [get_ports {pl_key[1]}]
set_property -dict {PACKAGE_PIN N13 ; IOSTANDARD LVCMOS33} [get_ports {pl_key[2]}]
set_property -dict {PACKAGE_PIN N14 ; IOSTANDARD LVCMOS33} [get_ports {pl_key[3]}]

# ==========================================
# 4. PS 端 LED (通过 MIO 引出)
# ==========================================
# PS 端 LED 不需要在 XDC 中约束, 由 Block Design 自动生成

# ==========================================
# 5. UART (PS 端 MIO 12/13)
# ==========================================
# UART 不需要在 XDC 中约束, 由 PS MIO 自动配置

# ==========================================
# 6. FMC LPC 接口 (如需使用)
# ==========================================
# set_property -dict {PACKAGE_PIN ... ; IOSTANDARD LVCMOS33} [get_ports {fmc_io[0]}]

# ==========================================
# 7. HDMI (如需使用)
# ==========================================
# set_property -dict {PACKAGE_PIN ... ; IOSTANDARD TMDS_33} [get_ports {hdmi_tx_clk}]

# ==========================================
# 8. SFP 光口 (如需使用)
# ==========================================
# SFP 使用高速差分信号, 需严格按原理图约束
```

### 4.2 时序约束 `constraints/z15_timing.xdc`

```tcl
##############################################################################
# Z15 ZYNQ7015 时序约束
##############################################################################

# ==========================================
# 1. 时钟约束
# ==========================================
# 板载 50MHz 晶振
create_clock -period 20.000 -name clk_50mhz [get_ports clk_50mhz]

# PL 端时钟 (假设使用时钟管理器产生 100MHz)
create_clock -period 10.000 -name clk_pl [get_cells {sys_block/clk_wizard_inst/clk_out1}]

# ==========================================
# 2. 输入输出延迟约束
# ==========================================
set_input_delay -clock clk_pl 2.0 [all_inputs]
set_output_delay -clock clk_pl 2.0 [all_outputs]

# ==========================================
# 3. False Path (异步信号, 无需时序分析)
# ==========================================
set_false_path -from [get_ports {*_async_in*}]
set_false_path -to [get_ports {*_async_out*}]
```

---

## 五、工程创建 Tcl 脚本

### `scripts/build_project.tcl`

```tcl
#!/usr/bin/env wish
###########################################################################
# Z15 ZYNQ Verilog 工程自动创建脚本
# 使用方法: vivado -mode batch -source scripts/build_project.tcl
###########################################################################

# 1. 重置
reset_run synth_1
reset_run impl_1

# 2. 设置工程名
set proj_name "z15_verilog_template"

# 3. 创建项目
create_project $proj_name ./ -part xc7z015clg485-2

# 4. 添加源文件
add_files ./src/top.v
add_files ./src/led_blink.v
add_files ./src/key_scan.v
add_files ./src/uart_tx.v
add_files ./src/uart_rx.v
add_files ./src/axi_gpio_ctrl.v
add_files ./src/pwm_generator.v
add_files ./src/timer_counter.v
add_files ./src/i2c_master.v

# 5. 添加约束文件
add_files -fileset constrs_1 ./constraints/z15_pins.xdc
add_files -fileset constrs_1 ./constraints/z15_timing.xdc

# 6. 设置顶层模块
set_property top top [current_fileset]

# 7. 添加仿真源 (可选)
# add_files -fileset sim_1 ./sim/tb_top.v

# 8. 生成比特流
launch_run synth_1
wait_on_run synth_1

launch_run impl_1
wait_on_run impl_1

puts "Project build completed successfully!"
```

---

## 六、Vivado 工程设置要点

### 6.1 综合 (Synthesis) 设置

| 选项 | 值 | 说明 |
|------|-----|------|
| **Target Specification** | `xc7z015clg485-2` | Z15 核心芯片 |
| **Top Module** | `top` | 顶层模块名 |
| **XDC Constraints** | `z15_pins.xdc`, `z15_timing.xdc` | 约束文件 |

### 6.2 实现 (Implementation) 设置

| 选项 | 值 | 说明 |
|------|-----|------|
| **Strategy** | `Performance_Explore` | 性能优化 |
| **Optimization Guide** | `Normal` | 常规优化 |
| **Timing Driven Placement** | `True` | 时序驱动 |

### 6.3 生成比特流设置

| 选项 | 值 |
|------|-----|
| **Compression** | `False` | 不压缩 (下载更快) |
| **Binary Format** | `Bitstream` |
| **Crypto Enable** | `False` | 不加密 |

---

## 七、工程导入与使用流程

### 7.1 从零搭建

```bash
# 方法一: GUI 方式
# 1. 启动 Vivado
# 2. File → New Project
# 3. 按第一章流程操作
# 4. 复制上述 Verilog 模块到 src/ 目录
# 5. 添加源文件并综合

# 方法二: Tcl 脚本一键构建
vivado -mode batch -source scripts/build_project.tcl
```

### 7.2 编译与下载

```bash
# 综合
vivado -mode batch -source scripts/run_synth.tcl

# 实现 + 生成比特流
vivado -mode batch -source scripts/run_impl.tcl

# 在线下载
vivado -mode tcl -source scripts/download_bitstream.tcl
```

### 7.3 运行综合

```tcl
# scripts/run_synth.tcl
open_project ./z15_verilog_template.xpr
open_run synth_1
report_utilization
report_timing_summary
```

---

## 八、常见错误与解决方案

### 8.1 综合阶段错误

| 错误信息 | 原因 | 解决方法 |
|----------|------|----------|
| `Cannot infer primitive` | 使用了非标准 Verilog 语法 | 改为可综合写法 |
| `Multiple drivers` | 同一信号多处赋值 | 改为 `reg` 或 `wire` 区分 |
| `Unresolved port connection` | 模块端口未匹配 | 检查端口名和宽度 |
| `Constraint missing` | 引脚未约束 | 补充 XDC 文件 |

### 8.2 实现阶段错误

| 错误信息 | 原因 | 解决方法 |
|----------|------|----------|
| `Timing violation` | 时序不满足 | 优化逻辑深度, 降低时钟频率 |
| `Placement error` | 资源不足 | 检查芯片选型是否正确 |
| `Routing congestion` | 局部资源过于拥挤 | 优化代码, 减少扇出 |

### 8.3 仿真阶段错误

| 错误信息 | 原因 | 解决方法 |
|----------|------|----------|
| `X propagation` | 初始值未设定 | 给所有 `reg` 赋初值 |
| `Infinite loop` | 仿真时间过长 | 检查 `initial` 块 |
| `VCD 无波形` | `$dumpvars` 调用错误 | 检查层级引用 |

---

## 九、扩展参考

### 9.1 Xilinx 官方文档

| 文档号 | 标题 | 用途 |
|--------|------|------|
| **UG585** | Zynq-7000 TRM | SoC 架构总览 |
| **PG150** | Zynq-7000 Getting Started | 入门指南 |
| **PG135** | Vivado Design Suite Tutorial | Vivado 使用教程 |
| **UG835** | Vivado Synthesis Reference Guide | 综合参考 |
| **UG905** | Vivado Implementing Design | 实现参考 |
| **UG974** | Vivado Using the Simulator | 仿真参考 |

### 9.2 正点原子资料

| 资源 | 链接 |
|------|------|
| **资料下载** | http://www.openedv.com/thread-349893-1-1.html |
| **视频课程** | https://www.bilibili.com/video/BV1rT4fe4EWD |
| **技术论坛** | http://www.openedv.com/forum.php |
| **ZYNQ 交流群** | 862548054 |

---

> **文档版本**：v1.0
> **最后更新**：2026-06-23
> **免责声明**：所有引脚号以正点原子 Z15 官方原理图为准
