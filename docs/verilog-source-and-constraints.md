# 源文件和约束来源说明

## 什么是源文件？

**源文件**就是包含 Verilog/VHDL 代码的文件（通常是 `.v` 或 `.vh` 后缀），它描述了你要设计的数字电路。

## 源文件从哪里来？

### 1. 自己编写 ✍️
这是最常见的方式：
- **功能设计阶段**：你根据需求编写模块代码
- **示例**：计数器、状态机、数据通路、控制逻辑
- **存放位置**：工程目录中的 `rtl/` (Register Transfer Level) 文件夹

```verilog
// 例如你自己写的 led_seq_ctrl.v 就是源文件
// 描述了 LED 流水灯的逻辑
module led_seq_ctrl (
    input  wire clk,
    output reg  [7:0] led
);
    // 你的设计逻辑
endmodule
```

### 2. 从开源库获取 📦
- GitHub 上有大量开源 FPGA 模块（UART、SPI、I2C、DDR 控制器等）
- 可以下载后直接放入工程中
- 示例：[OpenCores](https://www.opencores.org/)、[GitHub FPGA 标签](https://github.com/topics/fpga)

### 3. Xilinx/Intel 官方 IP 核 🧩
- Vivado 和 Quartus 内置 IP Catalog
- 可生成时钟管理、存储器控制、通信接口等模块
- 生成后会输出 `.v` 文件作为源文件

### 4. 前辈/公司的现有代码
- 团队共享的代码库
- 需要熟悉项目的编码规范和模块接口

---

## 什么是对齐约束文件？

**约束文件**告诉 FPGA 工具：
1. **哪些引脚对应哪个信号**（物理引脚分配）
2. **时钟频率是多少**（时序约束）
3. **其他物理限制**（电压标准、电阻等）

## 约束文件从哪里来？

### 1. 开发板厂家提供 ⚙️
- **Xilinx 开发板**: 购买时会附带引脚约束文件（`.xdc`）
- **Intel 开发板**: 提供 `.qsf` 或 `.sdc` 文件
- **示例**: Basys 3、Zybo、DE1-SoC 等都有官方约束文件

### 2. 从原理图手动编写 📐
- 查看开发板的原理图
- 找到每个信号对应的物理引脚编号
- 手动写入约束文件

```tcl
# 例如：LED0 连接到 G15 引脚
set_property PACKAGE_PIN G15 [get_ports {led[0]}]
set_property IOSTANDARD LVCMOS33 [get_ports {led[0]}]
```

### 3. 从旧项目复制
- 如果有类似的开发板，可以从旧工程中拷贝约束文件
- 然后根据新需求修改引脚号

### 4. Vivado/Quartus 自动生成
- Vivado: Tools → Create and Package New IP → 可生成约束模板
- Quartus: Assignments → Pin Planner 可视化编辑

---

## 总结

| 类型 | 来源 | 示例 |
|------|------|------|
| **源文件 (.v)** | 自己写、开源库、IP 核、团队代码 | counter.v、uart_rx.v |
| **约束文件 (.xdc/.qsf)** | 开发板提供、原理图手动编、旧项目拷贝 | pins.xdc、timing.xdc |

> **关键点**: 
> - **源文件** = 你写的逻辑代码（电路长什么样）
> - **约束文件** = 物理引脚分配（电路放在哪里、怎么连）
> - 两者缺一不可！没有源文件，FPGA 不知道要做什么；没有约束文件，FPGA 不知道该放到哪个引脚上。
