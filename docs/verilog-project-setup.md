# Verilog 工程项目新建步骤

## 一、准备工作

### 1.1 选择 EDA 工具
| 工具 | 适用场景 | 费用 |
|------|---------|------|
| **Vivado / Quartus** | Xilinx / Intel FPGA | 免费 (学生/个人) |
| **ModelSim / Questa Sim** | 仿真验证 | 免费试用 / 教育版 |
| **Verilator** | 快速仿真 | 完全免费开源 |
| **GTKWave** | 波形查看 | 完全免费 |

### 1.2 准备硬件平台信息
- **FPGA 型号**: 如 Xilinx Artix-7 (XC7A35T) 或 Intel Cyclone IV (EP4CE10)
- **引脚约束文件**: 对应的 .xdc (Xilinx) 或 .qsf (Intel) 文件
- **时钟频率**: 系统主频及分频需求

---

## 二、项目目录结构设计

```
my_project/
├── README.md           # 项目说明
├── Makefile            # 编译脚本 (可选)
│
├── rtl/                # 寄存器传输级源码
│   ├── tb_*.v          # 测试激励文件
│   ├── *_top.v         # 顶层模块
│   ├── *_ctrl.v        # 子模块
│   └── *_fifo.v        # 子模块
│
├── sim/                # 仿真相关
│   ├── wave.do         # ModelSim 波形配置
│   └── log/            # 仿真日志
│
├── constraints/        # 引脚约束
│   ├── pins.xdc        # Xilinx
│   └── timing.xdc      # 时序约束
│
├── ip/                 # IP 核文件
│   ├── clock_gen/
│   └── mem_config/
│
├── docs/               # 设计文档
│   ├── architecture.md
│   └── changelog.md
│
└── outputs/            # 综合/布线输出
    ├── *.bit           # 比特流
    └── *.rwrd          # 报告
```

---

## 三、以 Vivado 为例新建项目

### 3.1 启动 Vivado
```bash
vivado &
# 或使用图形界面
vivado
```

### 3.2 创建新项目
1. **File → New → Project**
2. **Project Name**: 输入项目名称,选择保存路径
3. **Project Type**: 选择 RTL Project (勾选 "Do not specify sources at this time" 可选)
4. **Add Sources**: 暂不添加 (后续手动添加)
5. **Add Constraints**: 暂不添加
6. **Default Part**: 选择 FPGA 器件 (如 `xc7a35ticsg324-1L`)
7. 点击 **Finish**

### 3.3 添加源文件
```
Flow Navigator → ADD SOURCES → Add designs → 添加所有 .v / .sv 文件
```

### 3.4 添加约束文件
```
Flow Navigator → ADD CONSTRAINTS → 添加 .xdc 文件
```

### 3.5 设置仿真
```
Flow Navigator → RUN SIMULATION → Run behavioral simulation
```

---

## 四、以 Quartus Prime 为例新建项目

### 4.1 启动 Quartus
```bash
quartus &
```

### 4.2 创建新项目
1. **File → New Project Wizard**
2. **Project name**: 输入项目名称
3. **Project location**: 选择路径
4. **Family & device**: 选择 Intel FPGA 系列及具体型号
5. **EDA tool settings**: 可选指定仿真工具 (ModelSim-Altera 等)
6. **Project type**: RTL Project
7. 点击 **Finish**

### 4.3 添加 Verilog 源文件
```
File → New / New and Add Existing → 选择 .v 文件
```

### 4.4 分配引脚
```
Assignments → Pin Planner → 编辑每个引脚位置
或导入 SDC/XDC 约束文件
```

---

## 五、编写第一个 Verilog 模块示例

### 5.1 计数器模块 (counter.v)
```verilog
module counter #(
    parameter WIDTH = 8
) (
    input  wire clk,
    input  wire rst_n,
    input  wire en,
    output reg  [WIDTH-1:0] count
);

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            count <= {WIDTH{1'b0}};
        end else if (en) begin
            count <= count + 1'b1;
        end
    end

endmodule
```

### 5.2 测试台 (tb_counter.v)
```verilog
`timescale 1ns / 1ps

module tb_counter();

    parameter WIDTH = 8;
    parameter CLK_PERIOD = 10;

    reg clk;
    reg rst_n;
    reg en;
    wire [WIDTH-1:0] count;

    // 实例化被测模块
    counter #(
        .WIDTH(WIDTH)
    ) uut (
        .clk(clk),
        .rst_n(rst_n),
        .en(en),
        .count(count)
    );

    // 时钟生成
    initial begin
        clk = 0;
        forever #(CLK_PERIOD/2) clk = ~clk;
    end

    // 激励序列
    initial begin
        rst_n = 0;
        en    = 0;
        #((CLK_PERIOD * 3) + 1);
        rst_n = 1;
        en    = 1;
        #((CLK_PERIOD * 256));
        $finish;
    end

    // 波形记录
    initial begin
        $dumpfile("counter.vcd");
        $dumpvars(0, tb_counter);
    end

endmodule
```

---

## 六、综合与实现关键步骤

### 6.1 综合 (Synthesis)
```
Run Synthesis → 检查 Report 无 Error/Warning
```

### 6.2 实现/布局布线 (Implementation)
```
Run Implementation → 检查时序收敛情况
```

### 6.3 生成比特流
```
Generate Bitstream → 输出 .bit 文件
```

### 6.4 在线调试 (ILA)
```
Add Source → IP Catalog → Integrated Logic Analyzer
在约束文件中分配 ILA 引脚
```

---

## 七、常用技巧与最佳实践

| 规则 | 说明 |
|------|------|
| **命名规范** | 模块名用小写蛇形,信号名用下划线分隔 |
| **参数化设计** | 使用 `parameter` 提高代码可复用性 |
| **阻塞/非阻塞赋值** | 组合逻辑用 `=`, 时序逻辑用 `<=` |
| **复位策略** | 优先使用同步低电平复位 (async reset, sync release) |
| **注释规范** | 模块级注释说明功能,行内注释解释关键逻辑 |
| **版本控制** | 使用 Git 管理源码,排除 *.o / *.rpt / *.bak 等中间文件 |
| **测试台先行** | 先写测试台再写模块,方便迭代验证 |
| **时序约束** | 尽早添加时钟约束,避免后期时序违例 |

### .gitignore 示例
```
*.o
*.so
*.elf
*.rpt
*.log
*.bak
*.ip_user_files
*.hw/*
*.ws/*
*.runs/*
*.srcs/*
```

---

## 八、Verilog 编码风格对比

```verilog
// ❌ 坏的写法
module bad(a,b,c);
input a,b;output c;
wire d;
assign c=a&b;
endmodule

// ✅ 好的写法
module logic_gate #(
    parameter WIDTH = 8
) (
    input  wire            clk,
    input  wire [WIDTH-1:0] a,
    input  wire [WIDTH-1:0] b,
    output reg  [WIDTH-1:0] c
);

    always @(posedge clk) begin
        c <= a & b;
    end

endmodule
```

---

## 附录: 常用语法速查

| 语法 | 说明 | 示例 |
|------|------|------|
| 模块定义 | 基本单元 | `module name (ports); endmodule` |
| 参数 | 可配置常量 | `#(parameter N=8)` |
| 端口声明 | 输入/输出/双向 | `input wire / output reg / inout` |
| 连续赋值 | 组合逻辑 | `assign o = a & b;` |
| always_ff | 时序逻辑 | `always @(posedge clk) q <= d;` |
| always_comb | 组合逻辑 | `always_comb y = sel ? a : b;` |
| 任务/函数 | 可调用代码块 | `task / function` |
| $display | 调试输出 | `$display("value = %h", val);` |
| $dumpfile | 波形保存 | `$dumpfile("wave.vcd");` |
