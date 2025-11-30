# 化工流程业务逻辑校验规则

本文档总结了化工流程编排器中实现的所有业务逻辑校验规则。

## 1. 节点类型连接规则 (NODE_COMPATIBILITY_RULES)

### 1.1 允许的连接

| 源节点类型 | 目标节点类型 | 说明 |
|-----------|-------------|------|
| Device (设备) | Sensor (传感器) | 设备可以连接传感器进行监测，如 Tank → Level Sensor |
| Sensor (传感器) | Logic (逻辑节点) | 传感器数据必须通过逻辑节点处理 |
| Logic (逻辑节点) | Logic (逻辑节点) | 支持复杂逻辑组合 |
| Logic (逻辑节点) | Actuator (执行器) | 逻辑判断后触发执行器 |
| Actuator (执行器) | Device (设备) | 执行器控制设备，如 Start → Pump |

### 1.2 禁止的连接及原因

| 源节点类型 | 目标节点类型 | 错误原因 |
|-----------|-------------|---------|
| Sensor | Actuator | **传感器不能直接连接执行器**。必须通过逻辑节点进行安全判断 |
| Device | Device | **设备不能直接连接设备**。需要通过传感器和执行器 |
| Device | Actuator | **设备不能直接连接执行器**。需要先连接传感器和逻辑节点 |
| Device | Logic | **设备不能直接连接逻辑节点**。必须先通过传感器读取数据 |
| Sensor | Device | **传感器不能连接设备**。传感器只读取数据，不控制设备 |
| Actuator | Sensor | **执行器不能连接传感器**。执行器控制设备，不产生传感器数据 |
| Actuator | Logic | **执行器不能连接逻辑节点**。逻辑必须在执行器之前，不能之后 |
| Actuator | Actuator | **执行器不能链接执行器**。每个设备只能有一个执行器 |

## 2. 设备-传感器兼容性规则

### 2.1 错误级别规则（Error）

| 设备类型 | 传感器类型 | 校验结果 | 原因 |
|---------|-----------|---------|------|
| Pump (泵) | Temperature (温度) | ❌ **禁止** | 泵的温度不是关键监测指标，应使用压力或流量传感器 |

**校验代码:** `INCOMPATIBLE_DEVICE_SENSOR`

### 2.2 警告级别规则（Warning）

| 设备类型 | 传感器类型 | 校验结果 | 建议 |
|---------|-----------|---------|------|
| Tank (罐) | Pressure (压力) | ⚠️ **警告** | 罐通常使用液位传感器，建议使用 Level Sensor |
| Valve (阀门) | Level (液位) | ⚠️ **警告** | 阀门通常使用压力传感器，建议使用 Pressure Sensor |

**校验代码:** `UNUSUAL_DEVICE_SENSOR`

### 2.3 推荐的设备-传感器配对

| 设备类型 | 推荐传感器 | 用途 |
|---------|-----------|------|
| Tank (罐) | Level (液位) | 监测储罐液位，防止溢出或空罐 |
| Pump (泵) | Pressure (压力) | 监测泵的输出压力，确保正常工作 |
| Pump (泵) | Level (液位) | 通过储罐液位控制泵的启停 |
| Valve (阀门) | Pressure (压力) | 监测阀门前后压差 |

## 3. 执行器-设备兼容性规则

### 3.1 错误级别规则（Error）

| 执行器类型 | 设备类型 | 校验结果 | 原因 |
|-----------|---------|---------|------|
| Start (启动) | Tank (罐) | ❌ **禁止** | 罐是被动容器，不能启动。应该控制泵或阀门 |
| Stop (停止) | Tank (罐) | ❌ **禁止** | 罐是被动容器，不能停止。应该控制泵或阀门 |

**校验代码:** `INVALID_ACTUATOR_DEVICE`

### 3.2 允许的执行器-设备配对

| 执行器类型 | 允许的设备 | 示例 |
|-----------|-----------|------|
| Start | Pump, Valve | Start → Pump (启动泵) |
| Stop | Pump, Valve | Stop → Pump (停止泵) |

## 4. 安全逻辑要求

### 4.1 泵控制安全逻辑

**规则:** 控制泵的逻辑节点应包含阈值比较（threshold comparison）

**校验代码:** `MISSING_SAFETY_THRESHOLD`

**示例:**
```
✅ 正确: Tank → Level Sensor → Greater Than (threshold: 80) → Stop Actuator → Pump
⚠️ 警告: Tank → Level Sensor → Delay → Stop Actuator → Pump (缺少阈值判断)
```

**原因:** 泵控制必须基于明确的阈值条件（如液位 > 80%），而不是简单的延时，以确保安全。

### 4.2 复合逻辑（允许）

使用 AND/OR 组合多个条件是允许的，因为可以实现更复杂的安全逻辑：

```
✅ 正确:
  Sensor1 → Greater Than → AND → Stop → Pump
  Sensor2 → Less Than    ↗
```

## 5. 控制路径完整性校验

### 5.1 完整控制路径要求

一个完整的化工流程控制路径应该包含：

```
Device → Sensor → Logic → Actuator → Device
```

**校验代码:** `INCOMPLETE_CONTROL_PATH`

**示例:**
```
✅ 完整路径: Tank A → Level Sensor → Greater Than → Stop → Pump C
⚠️ 不完整: Tank A → Level Sensor (没有后续的逻辑和执行器)
```

## 6. 逻辑节点输入要求

### 6.1 AND/OR 节点

- **要求:** 至少 2 个输入
- **错误代码:** `INSUFFICIENT_INPUTS`
- **原因:** AND 和 OR 运算至少需要两个条件

### 6.2 NOT 节点

- **要求:** 恰好 1 个输入
- **错误代码:** `INVALID_INPUT_COUNT`
- **原因:** NOT 运算只能对单个条件取反

### 6.3 比较节点 (Greater Than, Less Than, Equal)

- **要求:** 至少 1 个输入
- **错误代码:** `INSUFFICIENT_INPUTS`
- **原因:** 比较运算需要传感器输入

## 7. 其他校验规则

### 7.1 循环依赖检测

- **校验:** 检测图中是否存在环
- **错误代码:** `CIRCULAR_DEPENDENCY`
- **示例:** A → B → C → A ❌

### 7.2 孤立节点检测

- **校验:** 检测未连接的节点
- **错误代码:** `DISCONNECTED_NODE`
- **级别:** Warning

### 7.3 无效连接检测

- **校验:** 检测连接到不存在节点的边
- **错误代码:** `INVALID_CONNECTION`

## 8. 校验错误级别

### Error (错误)
- 阻止不安全或逻辑错误的配置
- 必须修复才能生成有效的流程定义
- 影响流程的正确性和安全性

### Warning (警告)
- 提示不推荐但技术上可行的配置
- 不阻止流程定义生成
- 建议用户重新考虑设计

## 9. 实现位置

### 规则定义
- **文件:** `src/types/dsl.ts`
- **常量:** `NODE_COMPATIBILITY_RULES`

### 校验实现
- **文件:** `src/utils/validator.ts`
- **主类:** `WorkflowValidator`
- **主要方法:**
  - `validate()` - 执行所有校验
  - `validateNodeConnections()` - 节点连接规则
  - `validateNodeCompatibility()` - 设备-传感器兼容性
  - `validateLogicNodeInputs()` - 逻辑节点输入校验
  - `validateCycles()` - 循环依赖检测
  - `validateDisconnectedNodes()` - 孤立节点检测

## 10. 使用示例

### 示例 1: 高液位自动停泵

```
✅ 正确配置:
Tank A → Level Sensor → Greater Than (80%) → Stop → Pump C

流程说明:
1. Tank A 通过 Level Sensor 监测液位
2. Level Sensor 输出到 Greater Than 逻辑节点（阈值 80%）
3. 当液位 > 80% 时，触发 Stop 执行器
4. Stop 执行器停止 Pump C
```

### 示例 2: 错误配置示例

```
❌ 错误 1: 传感器直接连接执行器
Tank A → Level Sensor → Stop → Pump C
错误: Sensors must connect through logic nodes before actuators for safety

❌ 错误 2: 泵连接温度传感器
Pump C → Temperature Sensor → ...
错误: Pumps cannot connect to temperature sensors. Use pressure or level sensors instead.

❌ 错误 3: 启动罐
... → Start → Tank A
错误: Cannot start a tank. Tanks are passive containers. Use start actuators for pumps or valves.
```

## 11. 总结

本化工流程编排器实现了全面的业务逻辑校验，确保：

1. ✅ **安全性**: 所有控制逻辑必须经过明确的判断，不允许传感器直接触发执行器
2. ✅ **正确性**: 设备-传感器配对符合工程实践，避免不合理的连接
3. ✅ **完整性**: 控制路径完整，避免孤立节点和死循环
4. ✅ **可维护性**: 清晰的错误提示帮助用户理解和修正问题

这些规则保证了生成的化工流程定义既符合安全规范，又符合工程实践。
