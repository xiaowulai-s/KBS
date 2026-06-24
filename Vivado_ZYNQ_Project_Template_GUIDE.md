# Vivado ZYNQ 工程模板 — 从零搭建最小系统

> **目标开发板**：正点原子 Z15 (Xilinx XC7Z015CLG485-2)
> **Vivado 版本**：≥ 2020.2 (推荐 2022.2 或更高)

---

## 一、新建工程 (Create Project)

### 1.1 步骤

1. **启动 Vivado** → `File` → `New Project`
2. **项目名称**：`z15_minimal` (或使用你自己的项目名)
3. **项目路径**：选择一个干净的文件夹
4. **项目类型**：`RTL Project` ✅ 勾选 "Do not specify sources at this time"
5. **Tcl Language** (可选)：后续可用 Tcl 脚本自动化

### 1.2 选择器件

| 参数 | 值 |
|------|-----|
| **Part** | `xc7z015clg485-2` |
| **Package** | `clg485` |
| **Speed Grade** | `-2` |
| **Vendor** | `xilinx` |

> 💡 **提示**：也可选择 `xc7z020` / `xc7z030` 等，但 I/O 数量和资源会有差异。

---

## 二、创建 Block Design (BDF)

### 2.1 新建 BD 文件

1. `Flow` → `Navigator` → `Run Blocking Synthesis` (或右键 `Create Block Design`)
2. 命名：`sys_block`
3. 双击打开 Block Design 画布

### 2.2 添加 Zynq IP 核

1. **点击 "+" 按钮** → 搜索 `Zynq` → 选择 `Zynq PS`
2. **双击 Zynq PS IP 核**，进行配置

### 2.3 Zynq PS 核心配置

#### 2.3.1 Static Properties

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| **FCLK_CLK0** | 100 MHz | PL 端主时钟 |
| **RESET** | 使能 | 复位信号 |
| **DDR** | 自动 | 无需手动配置 |

#### 2.3. MIO Configuration

| 外设 | MIO 编号 | 状态 |
|------|----------|------|
| **GEM (以太网)** | MIO 0-17 | ✅ Enable |
| **SD Card** | MIO 42-47 | ✅ Enable |
| **UART0** | MIO 12-13 | ✅ Enable |
| **USB0** | MIO 28-33 | ✅ Enable |
| **QSPI** | MIO 1-6 | ✅ Enable |
| **JTAG** | MIO 38-41 | ✅ Enable |

#### 2.3.3 AXI Permanent Connections

| 接口 | 说明 |
|------|------|
| **S_AXI_HPC0** | 可选，连接 PL 外设 |
| **S_AXI_HP0-3** | 可选，高性能端口 |
| **M_AXI_GP0** | 默认使能，用于 PL → PS 访问 |

#### 2.3.4 Peripheral Clocks

| 时钟 | 频率 | 说明 |
|------|------|------|
| **FCLK_CLK0** | 100 MHz | PL 端主时钟 |
| **FCLK_CLK1** | 禁用 | 如有需要可开启 |
| **FCLK_CLK2** | 禁用 | |
| **FCLK_CLK3** | 禁用 | |

#### 2.3.5 Interrupt

| 配置项 | 状态 |
|--------|------|
| **Interrupt Output** | `IRQ_F2P` → 启用 |
| **极性** | Active High |
| **宽度** | 1 bit (如有多个中断可扩展) |

### 2.4 添加基础外设 IP (可选)

#### UART (如果 MIO 未引出足够的 UART)

| IP 名称 | 说明 |
|---------|------|
| `axi_uart16552` | AXI 接口 UART |

#### GPIO (用户 LED / 按键)

| IP 名称 | 配置 |
|---------|------|
| `axi_gpio` | LED: 输出 8bit; 按键: 输入 4bit |

#### AXI Timer

| IP 名称 | 用途 |
|---------|------|
| `axi_timer` | 精确延时 / 周期性中断 |

#### AXI DMA (如需 DMA 传输)

| IP 名称 | 用途 |
|---------|------|
| `axi_dma` | HD2H / H2D 双向 DMA |

### 2.5 连接示例 (Block Diagram)

```
┌─────────────────────────────────────────────────┐
│                Zynq PS (Z7015)                    │
│                                                   │
│   ┌──────┐                                         │
│   │MIO   │◄──── GEM / UART / SD / USB / QSPI     │
│   └──┬───┘                                         │
│      │                                              │
│   ┌──▼───┐                                          │
│   │DDR   │ (自动挂载)                               │
│   └──────┘                                          │
│                                                   │
│   ┌──────────────────────────────────┐            │
│   │  M_AXI_GP0      FCLK_CLK0        │            │
│   │       ●──────────────●           │            │
│   │       │              │           │            │
│   │    PL 端            PL 时钟      │            │
│   │    外设 IP ←───────── 50MHz OSC │            │
│   └──────────────────────────────────┘            │
└─────────────────────────────────────────────────┘
```

### 2.6 生成 Output Products

1. 右键 `Zynq PS` IP → `Customize Block` → `OK`
2. 菜单栏：`Product Summary` → `Generate Output Products`
3. 全选 → `OK`
4. 同样对其他新增 IP 做此操作

### 2.7 连接端口

1. 使用工具栏连线工具或手动编写连接
2. 常见连接模板：

```tcl
# 将 PL 时钟连到 Zynq FCLK_CLK0
create_clock -period 10.000 -name clk_100mhz [get_ports clk_50mhz_in]
# 在 BD 内部使用 clock wizard 分频

# LED GPIO 输出
set_property -dict {PACKAGE_PIN H17 ; IOSTANDARD LVCMOS33} [leds_8bits_tri_o[0]]

# UART TX/RX
set_property -dict {PACKAGE_PIN G18 ; IOSTANDARD LVCMOS33} [uart_tx]
set_property -dict {PACKAGE_PIN F19 ; IOSTANDARD LVCMOS33} [uart_rx]
```

### 2.8 运行 Connection Automation

1. 右键画布空白处 → `Run Connection Automation`
2. 全选所有可自动连接的 IP → `OK`
3. Vivado 会自动连接 AXI 总线和时钟

---

## 三、添加约束文件 (XDC)

### 3.1 新建 XDC 文件

`File` → `Add Sources` → `Add or create constraints` → `sys_constraints.xdc`

### 3.2 Z15 开发板 XDC 模板

```tcl
##############################################################################
# Z15 ZYNQ 7015 - 正点原子开发板约束文件 (sys_constraints.xdc)
# Vivado 版本: ≥ 2020.2
##############################################################################

# -----------------------------------------------
# 1. 时钟
# -----------------------------------------------
# 板载 50MHz 时钟源
create_clock -period 20.000 -name clk_50mhz [get_ports clk_50mhz]

# -----------------------------------------------
# 2. LEDs (PL 端, 8 路)
# -----------------------------------------------
set_property -dict {PACKAGE_PIN H17 ; IOSTANDARD LVCMOS33} [get_ports {leds[0]}]
set_property -dict {PACKAGE_PIN J17 ; IOSTANDARD LVCMOS33} [get_ports {leds[1]}]
set_property -dict {PACKAGE_PIN H18 ; IOSTANDARD LVCMOS33} [get_ports {leds[2]}]
set_property -dict {PACKAGE_PIN J18 ; IOSTANDARD LVCMOS33} [get_ports {leds[3]}]
set_property -dict {PACKAGE_PIN K17 ; IOSTANDARD LVCMOS33} [get_ports {leds[4]}]
set_property -dict {PACKAGE_PIN K18 ; IOSTANDARD LVCMOS33} [get_ports {leds[5]}]
set_property -dict {PACKAGE_PIN L17 ; IOSTANDARD LVCMOS33} [get_ports {leds[6]}]
set_property -dict {PACKAGE_PIN L18 ; IOSTANDARD LVCMOS33} [get_ports {leds[7]}]

# -----------------------------------------------
# 3. 按键 (PL 端, 4 路)
# -----------------------------------------------
set_property -dict {PACKAGE_PIN M13 ; IOSTANDARD LVCMOS33} [get_ports {buttons[0]}]
set_property -dict {PACKAGE_PIN M14 ; IOSTANDARD LVCMOS33} [get_ports {buttons[1]}]
set_property -dict {PACKAGE_PIN N13 ; IOSTANDARD LVCMOS33} [get_ports {buttons[2]}]
set_property -dict {PACKAGE_PIN N14 ; IOSTANDARD LVCMOS33} [get_ports {buttons[3]}]

# -----------------------------------------------
# 4. UART (PS 端 MIO 12/13, 无需额外约束)
# -----------------------------------------------

# -----------------------------------------------
# 5. Ethernet (PS 端 MIO 0-17, 无需额外约束)
# -----------------------------------------------

# -----------------------------------------------
# 6. QSPI Flash (PS 端 MIO 1-6, 无需额外约束)
# -----------------------------------------------

# -----------------------------------------------
# 7. SD Card (PS 端 MIO 42-47, 无需额外约束)
# -----------------------------------------------

# -----------------------------------------------
# 8. HDMI (PL 端, 如需使用)
# -----------------------------------------------
# HDMI TX 时钟和 TMDS 信号
# set_property -dict {PACKAGE_PIN ... ; IOSTANDARD TMDS_33} [get_ports {hdmi_tx_clk}]
# set_property -dict {PACKAGE_PIN ... ; IOSTANDARD TMDS_33} [get_ports {hdmi_tx_data[0]}]

# -----------------------------------------------
# 9. FMC LPC (如需使用)
# -----------------------------------------------
# 请在官方原理图中查找 FMC 对应引脚约束

# -----------------------------------------------
# 10. 其他板载资源
# -----------------------------------------------
# 根据实际情况补充...
```

> ⚠️ **重要**：以上引脚号为参考值，请以正点原子 Z15 **官方原理图**为准进行核对修改。

---

## 四、综合与实现

### 4.1 综合流程

```
Run Synthesis     →  RTL 综合为网表
Run Implementation →  布局布线
Generate Bitstream →  生成 .bit 文件
```

| 步骤 | 预估时间 (Z7015) |
|------|------------------|
| **Synthesis** | 2-5 分钟 |
| **Implementation** | 10-30 分钟 |
| **Bitstream** | 3-8 分钟 |

### 4.2 检查报告

| 检查项 | 说明 |
|--------|------|
| **Timing Summary** | 建立时间 / 保持时间是否满足 |
| **Utilization** | LUT / FF / BRAM / DSP 占用率 |
| **Clock Uncertainty** | 时钟抖动分析 |

---

## 五、导出硬件 (Hardware Definition)

### 5.1 导出流程

1. `File` → `Export` → `Export Hardware`
2. 勾选 **Include bitstream**
3. 保存为 `z15_minimal.xsa`

> 此 `.xsa` 文件将在 Vitis / PetaLinux 中使用。

---

## 六、Vitis 裸机程序模板

### 6.1 创建 Vitis 工程

1. 启动 Vitis → `File` → `New` → `Application Project`
2. 选择 Z15 硬件平台 (`.xsa`)
3. 选择模板：`Hello World` (最小) 或 `Empty Application`

### 6.2 LED 闪烁裸机代码模板

```c
#include "xgpiops.h"
#include "sleep.h"

#define LED_PIN_GPIOPS 10  /* 根据实际 MIO 编号调整 */

int main() {
    XGpioPs gpio;
    XGpioPs_Config *cfg;

    /* 初始化 GPIO */
    cfg = XGpioPs_LookupConfig(XPAR_XGPIOPS_0_DEVICE_ID);
    XGpioPs_CfgInitialize(&gpio, cfg, cfg->BaseAddr);

    while (1) {
        /* LED 翻转 */
        XGpioPs_WritePin(&gpio, LED_PIN_GPIOPS, 1);
        usleep(500000);  /* 500ms */
        
        XGpioPs_WritePin(&gpio, LED_PIN_GPIOPS, 0);
        usleep(500000);
    }

    return 0;
}
```

### 6.3 PL 端 GPIO (AXI GPIO) 操作模板

```c
#include "xgpiops.h"
#include "xgpio.h"
#include "sleep.h"

#define GPIO_DEVICE_ID XPAR_AXI_GPIO_0_DEVICE_ID

int main() {
    XGpioPs gpio_ps;
    XGpio gpio_pl;
    XGpioPs_Config *cfg_ps;
    XGpio_Config *cfg_pl;

    /* 初始化 PS GPIO */
    cfg_ps = XGpioPs_LookupConfig(XPAR_XGPIOPS_0_DEVICE_ID);
    XGpioPs_CfgInitialize(&gpio_ps, cfg_ps, cfg_ps->BaseAddr);

    /* 初始化 PL GPIO (AXI GPIO) */
    cfg_pl = XGpio_LookupConfig(GPIO_DEVICE_ID);
    XGpio_CfgInitialize(&gpio_pl, cfg_pl, cfg_pl->BaseAddress);

    /* 设置 LED 方向为输出 */
    XGpio_SetDataDirection(&gpio_pl, 1, 0x00);

    while (1) {
        /* PL LED 翻转 (通道 1, 8bit 数据) */
        XGpio_DiscreteWrite(&gpio_pl, 1, 0xAA);
        usleep(500000);
        XGpio_DiscreteWrite(&gpio_pl, 1, 0x55);
        usleep(500000);
    }

    return 0;
}
```

---

## 七、PetaLinux Linux 系统 (可选)

### 7.1 创建 PetaLinux 工程

```bash
petalinux-create --type project --template zynq --name z15_linux
cd z15_linux
petalinux-config --get-hw-description=/path/to/project/export
```

### 7.2 内核配置

```bash
petalinux-config
# 在内核菜单中按需开启驱动：
# - Device Drivers → GPIO Support
# - Device Drivers → Character devices
# - File systems → SD/MMC/SDIO
```

### 7.3 构建

```bash
petalinux-build
```

### 7.4 打包 Boot.bin

```bash
petalinux-package --boot --format BIN --u-boot --fsbl --fpga ../z15_minimal.bit
```

---

## 八、工程目录结构参考

```
z15_minimal/
├── z15_minimal.xpr          # Vivado 工程文件
├── z15_minimal.ip_user_files/
├── sys_block.bd             # Block Design 文件
├── sys_block_wrapper.v      # 顶层包装 (自动生成)
├── sys_constraints.xdc      # 引脚约束
├── sys_timing.xdc           # 时序约束 (可选)
├── src/
│   ├── led_controller.v     # PL 端用户逻辑
│   └── ...
├── export/
│   └── z15_minimal.xsa      # 导出硬件
├── vitis/
│   ├── fsbl/                # FSBL 工程
│   └── hello_world/         # 应用工程
└── petalinux/
    ├── project.spec         # PetaLinux 配置
    └── ...
```

---

## 九、Tcl 一键建工程脚本

> 可将以下脚本保存为 `build_project.tcl`，在 Vivado Tcl Console 中运行：

```tcl
# ============================================
# Z15 ZYNQ 最小工程 Tcl 创建脚本
# ============================================

# 1. 新建工程
create_project z15_minimal ./z15_minimal -part xc7z015clg485-2

# 2. 创建 Block Design
create_bd_design sys_block

# 3. 添加 Zynq PS
cell [create_bd_cell -type ip -vlnv xilinx.com:ip:zynq_ultraeps_mp:1.0 zynq_ps] {
    # 注: 如果是 Zynq-7000 系列，应为:
    # cell [create_bd_cell -type ip -vlnv xilinx.com:ip:zynq_7000:1.0 zynq_ps]
}

# 4. 配置 Zynq PS (简化)
# 实际使用时需在 GUI 中精细配置

# 5. 生成输出
current_bd_instance sys_block
validate_bd_design
make_wrapper -files [get_files ./z15_minimal/z15_minimal.srcs/sources_1/bd/sys_block/sys_block.bd] -top

# 6. 添加约束
# add_files -fileset constrs_1 ./sys_constraints.xdc

# 7. 综合
launch_run synthesis
wait_on_run synthesis
```

> ⚠️ Tcl 脚本仅供参考框架，实际工程中建议在 **Vivado GUI** 中逐步配置以确保正确性。

---

## 十、常见问题排查

| 问题 | 原因 | 解决方法 |
|------|------|----------|
| **综合失败** | 约束缺失 / 端口未连接 | 检查 XDC 文件，确保所有端口已约束 |
| **时序不满足** | 时钟频率过高 | 降低 FCLK_CLK0 频率，检查组合逻辑路径 |
| **导出硬件报错** | 有未综合的 IP | 先运行 `Generate Output Products` |
| **Vitis 找不到 IP** | XSA 未包含 bitstream | 导出时勾选 "Include bitstream" |
| **UART 无输出** | 波特率 / 引脚配置错误 | 检查串口助手设置 (115200, 8N1) |

---

## 十一、附录

### 11.1 推荐阅读

1. **UG585** - Zynq-7000 TRM (Technical Reference Manual)
2. **PG150** - Zynq-7000 APSoC Getting Started Guide
3. **PG151** - Zynq-7000 ECSpec (Electrical Specifications)
4. **PG136** - Vivado Design Suite Tutorial Building and Debugging IP Subsystems

### 11.2 正点原子官方资料

| 资源 | 链接 |
|------|------|
| **资料下载** | http://www.openedv.com/thread-349893-1-1.html |
| **视频课程** | https://www.bilibili.com/video/BV1rT4fe4EWD |
| **技术支持** | http://www.openedv.com/forum.php |
| **交流群** | 862548054 |

---

> **文档版本**：v1.0
> **最后更新**：2026-06-23
