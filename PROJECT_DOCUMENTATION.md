# 低代码工艺流程编排器 - 项目文档

## 项目概述

这是一个基于 React + TypeScript 的**可视化工艺流程编排器**，专门为化工控制逻辑设计。它允许工艺专家通过拖拽的方式创建控制逻辑，而无需编程知识。

## 核心功能

### 1. 可视化画布编辑器
- 基于 React Flow 实现的拖拽式画布
- 支持设备节点、传感器节点、逻辑节点、执行器节点
- 实时节点连线和数据流向可视化

### 2. AST 转换引擎（核心功能）
位置：`src/utils/astConverter.ts`

将可视化图形转换为可执行的 AST/DSL：

**输入**：React Flow 图形节点和边
```typescript
nodes: [
  { id: 'sensor1', type: 'sensor', data: { sensorType: 'level' } },
  { id: 'logic1', type: 'logic', data: { logicType: 'greater_than' } },
  { id: 'actuator1', type: 'actuator', data: { actuatorType: 'stop' } }
]
edges: [
  { source: 'sensor1', target: 'logic1' },
  { source: 'logic1', target: 'actuator1' }
]
```

**输出**：JSON AST
```json
{
  "id": "rule_actuator1",
  "name": "Rule for Stop Pump",
  "condition": {
    "type": "comparison",
    "operator": ">",
    "left": { "type": "sensor", "sensorId": "sensor1" },
    "right": { "type": "constant", "value": 80 }
  },
  "action": {
    "type": "actuator",
    "actuatorType": "stop",
    "targetId": "pump_c"
  }
}
```

**关键算法**：
- 图遍历算法：从执行器节点回溯到传感器节点
- 条件树构建：递归构建逻辑表达式树
- 拓扑排序：确保依赖关系正确

### 3. 逻辑校验系统
位置：`src/utils/validator.ts`

实现多层次的静态检查：

#### 连接兼容性检查
```typescript
// 规则：传感器不能直接连接到执行器
if (source.type === 'sensor' && target.type === 'actuator') {
  throw new Error('Sensors must connect through logic nodes');
}
```

#### 循环依赖检测
使用 DFS 算法检测图中的环：
```typescript
detectCycle(nodeId, visited, recStack) {
  if (recStack.has(nodeId)) return true; // 发现环
  // ... 递归检查
}
```

#### 节点输入验证
- AND/OR 节点：至少需要 2 个输入
- NOT 节点：恰好需要 1 个输入
- 比较节点：至少需要 1 个输入

### 4. 双向绑定（图 ↔ JSON）
实时同步机制：
```typescript
useEffect(() => {
  // 图变化 → 自动更新 AST
  const ast = ASTConverter.graphToAST(nodes, edges);
  setAstJson(JSON.stringify(ast, null, 2));
}, [nodes, edges]);
```

支持反向导入：
```typescript
// JSON → 图
const { nodes, edges } = ASTConverter.astToGraph(astNodes);
setNodes(nodes);
setEdges(edges);
```

## 技术架构

### 组件设计模式

```
ProcessEditor (主编辑器)
├── NodePalette (节点面板)
│   ├── DeviceNodes (设备)
│   ├── SensorNodes (传感器)
│   ├── LogicNodes (逻辑)
│   └── ActuatorNodes (执行器)
├── Canvas (ReactFlow 画布)
│   ├── CustomNodes (自定义节点组件)
│   └── EdgeValidator (连接校验)
└── JSONViewer (AST/Rules 查看器)
    ├── ASTDisplay
    ├── RulesDisplay
    └── ValidationErrors
```

### DSL 数据结构

#### 节点类型定义
```typescript
enum NodeCategory {
  DEVICE = 'device',      // 设备：罐、泵、阀门
  SENSOR = 'sensor',      // 传感器：液位、温度、压力
  LOGIC = 'logic',        // 逻辑：AND, OR, >, <
  ACTUATOR = 'actuator'   // 执行器：启动、停止、打开、关闭
}
```

#### AST 节点结构
```typescript
interface ASTNode {
  id: string;
  type: NodeCategory;
  nodeType: string;        // 具体类型（如 'tank', 'level', 'and'）
  inputs: string[];        // 输入节点 ID 列表
  outputs: string[];       // 输出节点 ID 列表
  config: Record<string, any>; // 配置参数
}
```

#### 规则 DSL
```typescript
interface Rule {
  id: string;
  name: string;
  condition: Condition;    // 触发条件（可嵌套）
  action: Action;          // 执行动作
  enabled: boolean;
}
```

## 示例：高液位自动停泵

### 业务逻辑
"当 A 罐液位 > 80% 时，自动停止 C 泵"

### 可视化表示
```
[Tank A] → [Level Sensor] → [> 80] → [Stop] → [Pump C]
```

### 生成的 DSL
```json
{
  "id": "rule_stop_pump",
  "name": "High Level Auto-Stop Pump",
  "condition": {
    "type": "comparison",
    "operator": ">",
    "left": {
      "type": "sensor",
      "sensorId": "level_sensor_tank_a",
      "property": "level"
    },
    "right": {
      "type": "constant",
      "value": 80
    }
  },
  "action": {
    "type": "actuator",
    "actuatorType": "stop",
    "targetId": "pump_c",
    "params": {}
  },
  "enabled": true
}
```

## 性能优化策略

### 大规模节点处理（500+ 节点）

#### 1. 虚拟化渲染
```typescript
// React Flow 自带虚拟化
// 仅渲染视口内的节点
<ReactFlow
  nodes={nodes}
  edges={edges}
  // 自动启用虚拟化
/>
```

#### 2. 节点记忆化
```typescript
// 使用 React.memo 防止不必要的重渲染
export default memo(DeviceNode);
```

#### 3. 状态管理优化
```typescript
// 使用 Zustand 进行高效状态管理
// 避免全局重渲染
const useStore = create((set) => ({
  nodes: [],
  edges: [],
  updateNode: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map(n =>
        n.id === id ? { ...n, data } : n
      )
    }))
}));
```

#### 4. 校验防抖
```typescript
// 延迟校验，避免每次拖动都校验
const debouncedValidate = useMemo(
  () => debounce((nodes, edges) => {
    const result = WorkflowValidator.validate(nodes, edges);
    setValidationErrors(result.errors);
  }, 300),
  []
);
```

#### 5. AST 转换优化
```typescript
// 使用 Web Worker 在后台线程处理 AST 转换
const worker = new Worker('astConverter.worker.ts');
worker.postMessage({ nodes, edges });
worker.onmessage = (e) => setAst(e.data);
```

## 使用指南

### 启动项目
```bash
cd process-orchestrator
npm install
npm run dev
```

### 基本操作

1. **添加节点**：从左侧面板拖拽节点到画布
2. **连接节点**：拖动节点边缘的连接点创建连线
3. **查看 AST**：右侧面板实时显示生成的 JSON
4. **查看校验**：右侧面板显示校验错误和警告
5. **加载示例**：点击 "Load Example" 按钮加载预设示例

### 示例流程

#### 创建 "高液位停泵" 逻辑

1. 拖入 "Tank" 设备节点
2. 拖入 "Level Sensor" 传感器节点
3. 拖入 "> " 逻辑节点（设置阈值 80）
4. 拖入 "Stop" 执行器节点
5. 拖入 "Pump" 设备节点
6. 按顺序连接：Tank → Level Sensor → > 80 → Stop → Pump
7. 查看右侧生成的 AST 和规则

## 校验规则

### 错误级别

- **Error**：阻止执行的严重错误
  - 传感器直接连接执行器（缺少逻辑节点）
  - 设备直接连接设备
  - 循环依赖
  - 逻辑节点输入数量不足

- **Warning**：不影响执行但不推荐
  - 节点未连接
  - 泵控制缺少安全逻辑

### 兼容性矩阵

| Source → Target | Device | Sensor | Logic | Actuator |
|----------------|--------|--------|-------|----------|
| **Device**     | ❌     | ✅     | ❌    | ❌       |
| **Sensor**     | ❌     | ❌     | ✅    | ❌       |
| **Logic**      | ❌     | ❌     | ✅    | ✅       |
| **Actuator**   | ✅     | ❌     | ❌    | ❌       |

## 技术栈

- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **画布引擎**：React Flow (@xyflow/react)
- **状态管理**：React Hooks (useNodesState, useEdgesState)
- **样式**：CSS-in-JS (inline styles)
- **类型系统**：TypeScript 5.0+

## 文件结构

```
process-orchestrator/
├── src/
│   ├── components/
│   │   ├── ProcessEditor.tsx       # 主编辑器组件
│   │   └── nodes/
│   │       ├── BaseNode.tsx        # 基础节点组件
│   │       ├── DeviceNode.tsx      # 设备节点
│   │       ├── SensorNode.tsx      # 传感器节点
│   │       ├── LogicNode.tsx       # 逻辑节点
│   │       └── ActuatorNode.tsx    # 执行器节点
│   ├── types/
│   │   └── dsl.ts                  # DSL 类型定义
│   ├── utils/
│   │   ├── astConverter.ts         # AST 转换引擎（核心）
│   │   └── validator.ts            # 校验系统
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

## 核心代码解析

### AST 转换核心算法

```typescript
// 从图转换为 AST
static graphToAST(nodes: Node[], edges: Edge[]): ASTNode[] {
  // 1. 构建邻接表
  const adjacency = buildAdjacencyMap(edges);

  // 2. 遍历每个节点
  return nodes.map(node => ({
    id: node.id,
    type: node.type,
    nodeType: node.data[`${node.type}Type`],
    inputs: adjacency[node.id].inputs,
    outputs: adjacency[node.id].outputs,
    config: node.data.config
  }));
}

// 从图生成高级规则
static graphToRules(nodes: Node[], edges: Edge[]): Rule[] {
  const astNodes = this.graphToAST(nodes, edges);

  // 找到所有执行器节点（规则的动作）
  const actuators = astNodes.filter(n => n.type === 'actuator');

  // 为每个执行器回溯构建条件
  return actuators.map(actuator => ({
    id: `rule_${actuator.id}`,
    condition: this.buildCondition(actuator.id, astNodes), // 递归构建条件树
    action: this.buildAction(actuator)
  }));
}
```

### 校验系统核心算法

```typescript
// 检测循环依赖
private static validateCycles(nodes: Node[], edges: Edge[]): ValidationError[] {
  const visited = new Set<string>();
  const recStack = new Set<string>(); // 递归栈

  const hasCycle = (nodeId: string): boolean => {
    if (recStack.has(nodeId)) return true; // 发现环
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recStack.add(nodeId);

    // DFS 遍历
    const outgoing = edges.filter(e => e.source === nodeId);
    for (const edge of outgoing) {
      if (hasCycle(edge.target)) return true;
    }

    recStack.delete(nodeId);
    return false;
  };

  // 检查每个节点
  nodes.forEach(node => hasCycle(node.id));
}
```

## 扩展建议

### 1. 后端集成
- 将 DSL 发送到后端 PLC 控制器
- 实现实时监控和数据反馈
- 历史版本管理和回滚

### 2. 高级功能
- 节点配置面板（双击节点编辑参数）
- 子流程封装（将复杂逻辑封装为可复用组件）
- 模拟运行（在前端模拟控制逻辑）
- 导出为多种格式（Ladder Logic, Function Block）

### 3. 协作功能
- 多人实时协作编辑
- 版本控制和分支管理
- 审批流程

## 常见问题

### Q: 如何添加新的节点类型？

1. 在 `types/dsl.ts` 中添加类型定义
2. 创建新的节点组件（如 `NewNode.tsx`）
3. 在 `ProcessEditor.tsx` 中注册节点类型
4. 更新校验规则

### Q: 如何自定义 DSL 输出格式？

修改 `astConverter.ts` 中的转换逻辑：
```typescript
// 自定义输出格式
static graphToCustomDSL(nodes, edges) {
  const ast = this.graphToAST(nodes, edges);
  return transformToYourFormat(ast);
}
```

### Q: 性能瓶颈在哪里？

- **图渲染**：500+ 节点时使用虚拟化
- **AST 转换**：复杂图使用 Web Worker
- **校验**：使用防抖减少校验频率

## 演示要点

### PPT 演示结构

1. **业务背景**
   - 传统 PLC 编程的痛点
   - 低代码解决方案的价值

2. **技术架构**
   - 组件设计模式图
   - DSL 数据结构
   - AST 转换流程图

3. **核心功能演示**
   - 现场拖拽创建 "高液位停泵" 逻辑
   - 展示实时 JSON 生成
   - 演示校验错误（故意创建错误连接）

4. **代码深度**
   - AST 转换算法讲解
   - 校验系统实现
   - 性能优化策略

5. **扩展性**
   - 后端集成方案
   - 子流程封装
   - 协作功能设计

