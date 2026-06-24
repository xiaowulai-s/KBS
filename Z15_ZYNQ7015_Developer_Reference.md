# 正点原子 Z15 (ZYNQ 7015) 开发板 — 硬件开发者参考手册

> **商品链接**：https://detail.tmall.com/item.htm?id=830593854646
> **品牌**：正点原子 (ALIENTEK)
> **适用人群**：嵌入式开发、FPGA/Linux 双域开发、高速接口、AIoT 原型验证

---

## 一、核心硬件规格

### 1.1 SoC 芯片

| 参数 | 规格 |
|------|------|
| **型号** | Xilinx XC7Z015CLG485-2 |
| **系列** | Zynq-7000 (Zynq-7SOC) |
| **架构** | 双核 ARM Cortex-A9 + 可编程逻辑 (PL) |
| **制程** | 28nm CMOS |
| **PLL 频率** | - |
| **封装** | 485-pin FCCGA485 |

### 1.2 片上资源

| 资源项 | 规格 |
|--------|------|
| **DDR 容量** | 1 GB (通常 32-bit x2, 1600MHz) |
| **DDR 类型** | DDR3/DDR3L SDRAM |
| **Flash 存储** | 128 Mbit (16MB) QSPI Flash |
| **DSP Slice** | 400 个 |
| **逻辑单元 (LE)** | ~53K |
| **Block RAM** | 2.5 Mbit |
| **硬核 DSP** | 220 个 multiply-accumulate |
| **UART** | PS 端 4 路 + PL 可扩展 |
| **GPIO** | PS 端 32 路 + PL 数千路 |

### 1.3 ARM PS 端详情

| 接口/模块 | 数量 | 说明 |
|-----------|------|------|
| **Cortex-A9** | 2 核 | MPCore, 双核 @ 667 MHz / 866 MHz |
| **L2 Cache** | 256 KB | 共享 |
| **L1 Cache** | 32 KB I + 32 KB D (每核) | |
| **Gigabit Ethernet MAC** | 1 路 | PS 端千兆以太网 (RJ45) |
| **USB 2.0** | 4 路 Host | Type-A 母座 |
| **SD Card** | 1 路 | eMMC / SD 插槽 |
| **I2C** | 4 路 | |
| **SPI** | 4 路 | |
| **CAN** | 2 路 | CAN 2.0B |
| **ADC** | 1 路 (12-bit) | PS 端内置 |
| **DMA** | 4 通道 | |

### 1.4 可编程逻辑 (PL) 端 I/O

| 类别 | 说明 |
|------|------|
| **用户 I/O** | 可通过 FMC / 板载引脚引出 |
| **LVDS 差分对** | 最多 ~180 对 |
| **高速收发器** | 支持 PCIe / SFP |

---

## 二、板载外设与接口清单

### 2.1 通信接口

| 接口 | 规格 | 备注 |
|------|------|------|
| **千兆以太网** | 1× RJ45 (PS 端) | 支持 10/100/1000 Mbps |
| **SFP 光口** | 2× SFP+ (PL 端) | 每路最高 6.25 Gbps |
| **PCIe** | 1× PCIe 2.0 ×2 | PL 端高速串行接口 |

### 2.2 显示与视频

| 接口 | 规格 | 备注 |
|------|------|------|
| **HDMI 输出** | 1× HDMI Type-A | 支持 1080p@60Hz |
| **HDMI 输入** | 1× HDMI Type-A | 支持视频捕获 |
| **RGB LCD** | FPC 排线座 | 支持 4.3"/7"/10.1 寸等常见尺寸 |

### 2.3 存储扩展

| 接口 | 规格 | 备注 |
|------|------|------|
| **FMC LPC** | 1× FMC Low Profile Connector | 40-pin, 引出 PL  GPIO, 支持低功耗扩展卡 |
| **USB Host** | 4× USB 2.0 Type-A | PS 端 |
| **SD/eMMC** | 1× SD 卡槽 | PS 端 |
| **QSPI Flash** | 16 MB | PS 端启动存储 |

### 2.4 其他板载资源

| 资源 | 说明 |
|------|------|
| **调试接口** | JTAG 下载/调试 (Mini-USB 或 USB-TTL) |
| **电源输入** | DC 5V/2A 或 12V/2A 适配器 |
| **LED** | 用户 LED × 若干 (PL 端) |
| **按键** | 复位键 + 用户按键 |
| **拨码开关** | 启动模式选择 (QSPI / SD / JTAG) |

---

## 三、电源系统

### 3.1 供电规范

| 项目 | 规格 |
|------|------|
| **输入电压** | DC 5V / 12V (以实物为准) |
| **推荐电流** | ≥ 2 A |
| **接口类型** | DC 圆孔或 Type-C |

### 3.2 电源域

| 电源轨 | 用途 | 典型电压 |
|--------|------|----------|
| **VCCINT** | Core / PLL | 1.0 V |
| **VCCBRAM** | Block RAM | 1.0 V |
| **VCCAUX** | Auxiliary | 1.8 V |
| **VCCO** | Bank I/O (各电压可选) | 1.8 V / 2.5 V / 3.3 V |
| **VCCO\_PL** | PL Bank I/O | 1.8 V / 2.5 V / 3.3 V |
| **VCCO\_PS** | PS Bank I/O | 1.8 V / 2.5 V / 3.3 V |

---

## 四、开发环境与软件栈

### 4.1 官方工具链

| 工具 | 版本要求 | 用途 |
|------|----------|------|
| **Vivado Design Suite** | ≥ 2020.2 | FPGA / Zynq SoC 综合、布局布线 |
| **Vitis SDK** | ≥ 2020.2 | ARM 端裸机 / BSP / 软件调试 |
| **PetaLinux** | ≥ 2020.2 | Linux 系统定制 |
| **XSDB** | 随 Vivado | JTAG 调试 |

### 4.2 正点原子配套软件

| 资源 | 说明 |
|------|------|
| **《正点原子ZYNQ篇》** | 完整开发教程 (PDF + 源码) |
| **视频教程** | B 站 / 正点原子云平台在线课程 |
| **参考工程** | 裸机 / Linux / PCIe / HDMI 等例程 |
| **Ubuntu 虚拟机镜像** | 预装 Vivado + Vitis + PetaLinux |

### 4.3 开发模式支持

| 模式 | 说明 |
|------|------|
| **FPGA 模式** | 仅使用 PL 端逻辑 |
| **PS 裸机** | ARM 端跑裸机程序 (LLD) |
| **PS + PL 协同** | ARM 控制 + PL 加速 |
| **Linux (PetaLinux)** | ARM 跑 Linux, PL 做加速器 |
| **RTOS** | FreeRTOS / RT-Thread 等 |
| **Vitis AI** | 部署轻量 AI 推理 |

---

## 五、PCB 与机械尺寸

### 5.1 外形尺寸 (参考)

| 项目 | 规格 |
|------|------|
| **整体尺寸** | ≈ 150mm × 100mm (含 FMC 连接器) |
| **核心板尺寸** | ≈ 55mm × 30mm (MMBX 标准) |
| **层数** | 8 层或以上 (高速板) |
| **板厚** | 1.6 mm (标准) |

### 5.2 FMC 连接器引脚分配

| 组 | 引脚数 | 可用 GPIO | 备注 |
|----|--------|-----------|------|
| **FMC LPC (40-pin)** | 40 | ~28 路差分 / ~56 路单端 | 低速扩展 |

> ⚠️ 具体 I/O 分配请参阅官方原理图和 I/O Port 表。

---

## 六、开发者必须掌握的关键知识点

### 6.1 硬件层面

- [ ] **原理图阅读**：了解 PS-PL 互联、时钟树、电源树、复位电路
- [ ] **引脚约束 (XDC)**：掌握 Vivado constraints 格式，了解哪些 PL 引脚引出到了哪些板载外设
- [ ] **DDR 配置**：Memory Controller IP 的参数设置、timing 计算
- [ ] **时钟系统**：板载晶振频率 (通常 50MHz)、PLL 配置、时钟域交叉 (CDC)
- [ ] **启动流程**：QSPI Boot → SD Boot → JTAG，了解 Boot.bin 的构建 (FSBL +.bit + u-boot)
- [ ] **FMC 扩展卡**：选择与对接、信号完整性注意事项

### 6.2 软件层面

- [ ] **Vivado Block Design**：Zynq IP 核配置、AXI 总线互联、中断映射
- [ ] **PS-PL AXI 通信**：LPD/UPD 区域、AXI HP/HPC/FPI 端口选择
- [ ] **Linux Device Tree**：PL 端自定义 IP 在 DT 中的绑定 (overlay 机制)
- [ ] **PCIe DMA 传输**：PL 端 AXI DMA → PCIe → PS DDR 数据通路
- [ ] **HDMI 视频链路**：AXI Video Stream IP → TMDS encoder → HDMI Tx

### 6.3 调试手段

| 方式 | 说明 |
|------|------|
| **JTAG** | 最快开发阶段调试，下载 + 在线调试 |
| **UART (串口)** | 最常用日志输出 + 命令行交互 |
| **Ethernet TFTP/NFS** | 大文件系统加载、远程调试 |
| **Vitis Debug** | 断点、变量监视、内存查看 |
| **ILA (Integrated Logic Analyzer)** | PL 端内嵌逻辑分析器，抓信号 |

---

## 七、典型应用场景

| 场景 | 说明 |
|------|------|
| **工业控制** | PLC 控制器上位、运动控制 |
| **高速数据采集** | ADC/DAC + FPGA 预处理 |
| **视频图像处理** | 机器视觉、视频编码/解码 |
| **5G/通信** | SFP 光模块、协议解析 |
| **边缘 AI** | 轻量神经网络推理加速 |
| **原型验证** | 算法硬件加速验证平台 |

---

## 八、常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| **无法下载** | 驱动未安装/USB 线问题 | 安装 CH340/JTAG 驱动，换线重试 |
| **Linux 不启动** | SD 卡镜像损坏/启动模式不对 | 重烧 SD 卡、检查拨码开关 |
| **以太网不通** | PHY 驱动未适配/网线问题 | 检查 PHY 型号驱动、替换网线 |
| **PL 无输出** | XDC 约束错误/IP 未配置 | 对照原理图核对引脚、检查时钟 |
| **HDMI 无信号** | 分辨率不匹配/TMDS 配置错误 | 检查 HDMI Tx IP 参数、确认 EDID |

---

## 九、参考资料与下载

| 资源 | 链接 |
|------|------|
| **资料下载中心** | http://www.openedv.com/thread-349893-1-1.html |
| **视频演示 (B站)** | https://www.bilibili.com/video/BV1rT4fe4EWD |
| **官方博客 (CSDN)** | https://www.cnblogs.com/zdyz/p/18413436 |
| **官方文档** | Xilinx PG152 (Zynq UltraScale+), PG150 (Zynq-7000) |
| **交流群** | 正点原子 ZYNQ 群：862548054 |

---

> **最后更新**：2026-06-23
> **文档作者**：基于正点原子官方信息整理
> **免责声明**：硬件规格以实物为准，使用前请查阅官方原理图和数据手册
