# LED 流水灯工程实例

## 项目概述

这是一个完整的 Verilog FPGA 入门工程，实现 8 位 LED 流水灯效果。适合初学者学习新建工程、编写代码、约束引脚、综合烧录的完整流程。

- **目标芯片**: Xilinx Artix-7 (XC7A35T)
- **开发工具**: Vivado 2023.2 或更高版本
- **功能描述**: 8 个 LED 依次点亮，形成流水灯效果

## 工程目录结构

```
led_strip_project/
├── README.md                    # 本文件
├── rtl/                         # Verilog 源文件
│   ├── led_strip_top.v          # 顶层模块
│   ├── counter_div.v            # 分频器模块
│   └── led_seq_ctrl.v           # LED 流水控制模块
├── sim/                         # 仿真文件
│   ├── tb_led_strip_top.v       # 测试台
│   └── wave.do                  # GTKWave 波形配置
├── constraints/                 # 约束文件
│   └── pins.xdc                 # 引脚分配约束
├── docs/                        # 设计文档
│   └── design_notes.md          # 设计说明
└── outputs/                     # 输出目录（自动生成）
    ├── led_strip_run/
    └── synth_design/
```

## 快速开始

### 1. 在 Vivado 中新建工程

1. 打开 Vivado，选择 **File → New → Project**
2. 项目名称: `led_strip_project`
3. 项目类型: **RTL Project**
4. 默认部件: 选择 `xc7a35ticsg324-1L` (Artix-7)
5. 完成创建后，在左侧 **ADD SOURCES** 添加 `rtl/` 下的所有 `.v` 文件
6. 在 **ADD CONSTRAINTS** 添加 `constraints/pins.xdc`
7. 运行 **RUN SYNTHESIS** → **RUN IMPLEMENTATION** → **GENERATE BITSTREAM**

### 2. 仿真验证

```bash
# 使用 ModelSim
vsim -f file_list.f
# 或使用 GTKWave 查看波形
gtkwave counter.vcd
```

## 模块说明

### 1. 分频器 (`counter_div.v`)

将 50MHz 系统时钟分频为 1Hz 低频时钟，使 LED 变化肉眼可见。

### 2. LED 流水控制 (`led_seq_ctrl.v`)

接收分频后的时钟，控制 8 个 LED 依次点亮，形成流水效果。

### 3. 顶层模块 (`led_strip_top.v`)

实例化分频器和 LED 控制模块，连接内外接口。

## 引脚约束 (Xilinx Artix-7)

以下约束基于常见开发板（如 Basys 3 / Zybo）:

```tcl
# 系统时钟 50MHz
set_property PACKAGE_PIN E3 [get_ports clk]
set_property IOSTANDARD LVCMOS33 [get_ports clk]
create_clock -period 20.000 [get_ports clk]

# LED 输出 (8 位)
set_property PACKAGE_PIN G15 [get_ports {led[0]}]
set_property PACKAGE_PIN H15 [get_ports {led[1]}]
set_property PACKAGE_PIN J15 [get_ports {led[2]}]
set_property PACKAGE_PIN L15 [get_ports {led[3]}]
set_property PACKAGE_PIN M14 [get_ports {led[4]}]
set_property PACKAGE_PIN N14 [get_ports {led[5]}]
set_property PACKAGE_PIN P14 [get_ports {led[6]}]
set_property PACKAGE_PIN R15 [get_ports {led[7]}]

# 按钮复位
set_property PACKAGE_PIN T15 [get_ports btn_rst_n]
set_property IOSTANDARD LVCMOS33 [get_ports btn_rst_n]
```

> **注意**: 实际引脚号需要根据你的开发板原理图调整。查阅板卡手册找到对应 GPIO 引脚号。

## 编译与烧录

1. **综合 (Synthesis)**: Flow Navigator → Run Synthesis
2. **实现 (Implementation)**: Flow Navigator → Run Implementation
3. **生成比特流**: Flow Navigator → Generate Bitstream
4. **打开硬件管理器**: Open Hardware Manager → Connect → Program Device

## 扩展建议

- 改变流水方向：双向循环
- 增加按键切换速度：多档分频比
- 添加跑马灯效果：多段同时亮起
- 加入音频反馈：配合蜂鸣器

## 相关文件

- [Verilog 工程新建步骤](./verilog-project-setup.md)
- [Xilinx Artix-7 数据手册](https://www.xilinx.com/support/documentation/data_sheets/ds181_Artix_7_Data_Sheet.pdf)

---

**创建日期**: 2026-06-23
**作者**: Agnes
**版本**: v1.0

## 工程文件清单

以下是一个可直接使用的 LED 流水灯完整工程：

- `led_strip_project/` 目录包含了所有源代码、约束文件、仿真文件和脚本。
- 可以直接复制到 Vivado 中使用，或者作为参考模板自行搭建项目。
