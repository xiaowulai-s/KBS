# LED Strip Project - FPGA 流水灯工程

## 项目简介

这是一个完整的 Verilog FPGA 入门项目，实现 8 位 LED 流水灯效果。包含 RTL 源码、测试台、引脚约束、仿真脚本和设计文档。

## 目录结构

```
led_strip_project/
├── rtl/                    # Verilog 源文件
│   ├── led_strip_top.v     # 顶层模块
│   ├── counter_div.v       # 分频器
│   └── led_seq_ctrl.v      # LED 流水控制
├── sim/                    # 仿真文件
│   ├── tb_led_strip_top.v  # 测试台
│   └── wave.do             # GTKWave 波形配置
├── constraints/            # 引脚约束
│   └── pins.xdc            # Xilinx 约束
├── docs/                   # 设计文档
│   └── design_notes.md
├── Makefile                # 编译/仿真脚本
└── README.md               # 本文件
```

## 快速开始

### 方法一：使用 Makefile (Icarus Verilog)

```bash
make simulate    # 运行行为仿真
make clean       # 清理生成的文件
```

### 方法二：使用 Vivado GUI

1. 打开 Vivado，新建 RTL Project
2. 添加 `rtl/` 下的所有 `.v` 文件
3. 添加 `constraints/pins.xdc`
4. 运行 Synthesis → Implementation → Generate Bitstream
5. 连接开发板并 Programming

## 模块说明

| 模块 | 功能 |
|------|------|
| `led_strip_top` | 顶层集成模块 |
| `counter_div` | 50MHz → 1Hz 分频器 |
| `led_seq_ctrl` | 8 位 LED 流水控制 |

## 引脚约束

参考 `constraints/pins.xdc`，根据实际开发板修改 PACKAGE_PIN。

## 目标芯片

- Xilinx Artix-7 (XC7A35T)
- 兼容 Vivado 2023.2+

## 许可证

MIT License

---

**作者**: Agnes  
**日期**: 2026-06-23  
**版本**: v1.0
