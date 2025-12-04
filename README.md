# 化工流程可视化编排器
这是一个基于 React + TypeScript 的可视化工艺流程编排器，专门为化工控制逻辑设计。它允许工艺专家通过拖拽的方式创建控制逻辑，并且可以实现图和逻辑代码的实时转换。


## 第一部分：设计思想与DSL架构

### 组件设计模式
在架构设计上，我采用了**分层设计**的思想，将系统分为三个核心层次：

#### 第一层：可视化层 - 画布编辑层
- 使用React Flow框架构建交互式画布
- 定义了四种基础节点类型：
  - **Device（设备）**：电解槽（Electrolyzer）、储罐（Tank）、泵（Pump）
  - **Sensor（传感器）**：液位传感器（Level）、温度传感器（Temperature）、压力传感器（Pressure）
  - **Logic（逻辑节点）**：AND、OR、大于（>）、小于（<）、延时（Delay）
  - **Actuator（执行器）**：启动（Start）、停止（Stop）
- 每种节点都是独立的React组件，使用React.memo进行性能优化
- 画布负责显示节点、处理用户拖拽、维护拓扑关系

每个节点包含以下参数：
- **id**：唯一标识符
- **type**：节点类型（device/sensor/logic/actuator）
- **position**：画布上的坐标 {x, y}
- **data**：节点数据
  - label：显示标签（可双击编辑）
  - 子类型：如deviceType、sensorType、logicType、actuatorType
  - config：配置参数，如threshold（阈值）、delayMs（延时毫秒数）

#### 第二层：DSL语言抽象层
这是我设计的核心，定义了整个流程编排器的数据语言。这层负责把画布上的图（节点+边）转换成DSL，或者把DSL再变回图，实现"图 ↔ JSON"双向绑定。

DSL设计遵循四大原则：
1. **可组合性**：条件可以无限组合成树状结构（AST）
   ```
   (液位 > 80%) AND (压力 < 5bar) OR (温度 > 100°C)
   ```
2. **可解释性**：后端可以直接"执行"DSL，不依赖前端
3. **可逆性**：DSL结构完整，可以完全还原成图（graph）
4. **与界面强解耦**：DSL不是UI的产物，而是流程本身的抽象语言

因此，DSL分成三个核心部分：
**1. Condition（条件表达式）**
用于表示各种逻辑判断，支持AND/OR嵌套、比较节点、延时节点。

示例："液位 > 80"
```json
{
  "type": "comparison",
  "operator": ">",
  "left": {
    "type": "sensor",
    "sensorId": "level_sensor",
    "sensorLabel": "Level Sensor",
    "property": "level"
  },
  "right": { "type": "constant", "value": 80 }
}
```

**2. Action（执行动作）**
用于描述对设备的操作，如启动泵、停止泵、打开阀门。

示例："停止泵C"
```json
{
  "type": "actuator",
  "actuatorType": "stop",
  "targetId": "pump_c",
  "targetLabel": "Pump C"
}
```

**3. Rule（工艺规则）**
一条完整的"自动控制逻辑"，包含id、name、condition、action、enabled（是否激活）。

示例："当储罐液位大于80%时，停止泵C"
```json
{
  "id": "rule_stop_pump_c",
  "name": "High Level Auto-Stop Pump",
  "condition": { /* 条件树 */ },
  "action": { /* 执行动作 */ },
  "enabled": true
}
```

#### 第三层：业务逻辑校验层
实现了所有化工流程的安全规则：

1. 首先定义宽泛的节点连接规则，如
    - 设备和设备不能直接相连
    - 传感器必须通过逻辑节点才能连接执行器
2. 然后定义了更加细化的业务逻辑，比如
    - 泵不能连接温度计
    - 罐不能连接启动或停止的执行器
  
    并且区分了错误和警告两个级别。
3. 此外我还对逻辑节点输入要求进行了规定：
    - AND/OR 节点至少 2 个输入
    - 比较节点至少 1 个输入


## 第二部分：从图到代码的映射

### 双向转换机制

这个系统最核心的技术挑战是：**如何将图形拓扑结构抽象为逻辑代码（AST抽象语法树）**。

我实现了**双向转换**机制：

#### 方向一：Graph → DSL（图转代码）
当用户在画布上连接节点时，系统通过DSLConverter类的`graphToRules`方法：

1. **构建邻接表**：遍历所有边，为每个节点记录其输入和输出连接
   ```typescript
   const edgeMap = new Map<string, { inputs: string[]; outputs: string[] }>();
   edges.forEach((edge) => {
     sourceData.outputs.push(edge.target);
     targetData.inputs.push(edge.source);
   });
   ```

2. **从执行器逆向追溯**：找到所有Actuator节点，作为Rule的起点
   ```typescript
   const actuatorNodes = dslNodes.filter((n) => n.type === 'actuator');
   ```

3. **递归构建条件树**：从执行器的输入节点开始，递归追溯到传感器或设备
   ```typescript
   private static buildCondition(nodeId: string, dslNodes: DSLNode[], nodes: Node[]): Condition {
     const node = dslNodes.find((n) => n.id === nodeId);

     if (node.type === 'logic') {
       const leftNode = node.inputs[0] ? dslNodes.find((n) => n.id === node.inputs[0]) : null;

       return {
         type: 'comparison',
         operator: operatorMap[node.logicType],
         left: leftNode ? this.buildCondition(leftNode.id, dslNodes, nodes) : { type: 'constant', value: 0 },
         right: { type: 'constant', value: node.config.threshold || 0 },
       };
     }

     if (node.type === 'sensor') {
       return {
         type: 'sensor',
         sensorId: node.id,
         sensorLabel: nodes.find(n => n.id === node.id)?.data.label,
         property: node.config.property || 'value',
       };
     }
   }
   ```

4. **生成完整Rule**：将条件树、执行器动作、目标设备组合成Rule对象

#### 方向二：DSL → Graph（代码转图）

当用户编辑JSON格式的DSL后，点击"Apply to Graph"，系统通过`rulesToGraph`方法：

1. **解析Rule列表**：遍历每个Rule，提取condition和action
   ```typescript
   rules.forEach((rule) => {
     const { nodes: ruleNodes, edges: ruleEdges, nodeCount } =
       this.conditionToNodes(rule.condition, currentY, rule.action.targetId);
   });
   ```

2. **递归展开条件树**：深度优先遍历条件树，为每个节点创建对应的React Flow节点
   ```typescript
   private static conditionToNodes(condition: Condition, currentY: number, targetDeviceId: string) {
     if (condition.type === 'sensor') {
       // 创建设备节点 → 传感器节点
       const deviceNode = { type: 'device', position: { x: 100, y: currentY } };
       const sensorNode = { type: 'sensor', position: { x: 100, y: currentY + 200 } };
       return { nodes: [deviceNode, sensorNode], edges: [...], nodeCount: 2 };
     }

     if (condition.type === 'comparison') {
       // 递归处理左侧条件，然后创建逻辑节点
       const leftResult = this.conditionToNodes(condition.left, currentY, targetDeviceId);
       const logicNode = { type: 'logic', position: { x: 100, y: currentY + leftResult.nodeCount * 200 } };
       return { nodes: [...leftResult.nodes, logicNode], edges: [...], nodeCount: leftResult.nodeCount + 1 };
     }
   }
   ```

3. **计算节点位置**：
   - **固定x轴 = 100**（所有节点在同一垂直线上）
   - **y轴间隔 = 200px**（每个节点间距200像素）
   - 通过nodeCount累计偏移量

4. **生成边连接**：根据节点间的逻辑关系，创建Edge对象连接所有节点


## 第三部分：交互体验演示

大家看到，我点击`Load Example`按钮，系统自动加载了一个 **高液位自动停泵** 的示例流程：

1. **Tank A（储罐A）** → 连接到 → **Level Sensor（液位传感器）**
   - 传感器读取储罐的液位数据

2. **Level Sensor** → 连接到 → **Greater Than（大于逻辑）**
   - 判断液位是否大于80%
   - 双击节点可以修改这个阈值

3. **Greater Than** → 连接到 → **Stop Actuator（停止执行器）**
   - 当条件满足时，触发停止动作

4. **Stop Actuator** → 连接到 → **Pump C（泵C）**
   - 停止泵的运行

整个流程形成了一个完整的自动化控制逻辑：**当储罐液位超过80%时，自动停止泵，防止溢出**。

右侧的JSON面板实时显示对应的DSL代码，这就是我刚才讲的图到代码的映射。


## 第四部分：性能优化与状态管理

最后，我想谈谈大规模场景下的性能优化。

### 问题场景
如果画布上有**500个节点**，会面临什么性能挑战？

1. **渲染性能**：每次状态更新都要重新渲染500个节点
2. **计算复杂度**：校验规则需要遍历所有节点和边
3. **内存占用**：大量节点数据驻留在内存中

### 本项目已实现的优化
#### 1. React.memo 优化节点组件
所有节点组件都使用`React.memo`包装：

```typescript
export default memo(DeviceNode);
export default memo(SensorNode);
export default memo(LogicNode);
export default memo(ActuatorNode);
```

这样只有当节点的props发生变化时才重新渲染，避免不必要的渲染。

#### 2. useMemo 缓存 nodeTypes 对象
防止每次渲染都重新创建nodeTypes对象，导致ReactFlow不必要的重新渲染：

```typescript
const nodeTypes = useMemo<NodeTypes>(
  () => ({
    device: DeviceNode,
    sensor: SensorNode,
    logic: LogicNode,
    actuator: ActuatorNode,
  }),
  []
);
```

#### 3. 防抖（Debounce）校验逻辑、
问题：用户快速拖拽节点时，每次位置变化都会触发DSL转换和校验，导致性能问题。

解决方案：使用300ms防抖延迟，只在用户停止操作后才执行校验：

```typescript
const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  if (nodes.length > 0 && !isEditingRules) {
    // 清除之前的timeout
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    // 设置300ms防抖
    validationTimeoutRef.current = setTimeout(() => {
      const rules = DSLConverter.graphToRules(nodes, edges);
      const validation = WorkflowValidator.validate(nodes, edges);
      setValidationErrors(validation.errors);
    }, 300);
  }
}, [nodes, edges, isEditingRules]);
```

效果对比：
- **优化前**：拖拽10个节点可能触发50+次校验，界面卡顿
- **优化后**：拖拽过程中不执行校验，停止后300ms执行1次，界面流畅

#### 4. useCallback 稳定函数引用
对所有事件处理函数使用useCallback包装，防止子组件不必要的重新渲染：

```typescript
const clearCanvas = useCallback(() => {
  setNodes([]);
  setEdges([]);
}, [setNodes, setEdges]);

const handleApplyToGraph = useCallback(() => {
  const rules = JSON.parse(rulesJson);
  const { nodes: newNodes, edges: newEdges } = DSLConverter.rulesToGraph(rules);
  setNodes(newNodes);
  setEdges(newEdges);
}, [rulesJson, setNodes, setEdges]);
```

#### 5. React Flow 内置优化
React Flow框架本身提供了虚拟化渲染：
- 只渲染视口内可见的节点
- 视口外的节点不参与DOM渲染
- 使用Canvas进行连线绘制，而不是SVG


### 进一步的优化方向
#### 1. 虚拟化列表
对于节点面板，可以使用`react-window`实现虚拟滚动：
```typescript
import { FixedSizeList } from 'react-window';

// 只渲染可见区域的节点
<FixedSizeList
  height={600}
  itemCount={nodes.length}
  itemSize={50}
>
  {NodePaletteItem}
</FixedSizeList>
```

#### 2. Web Worker 异步计算
将校验逻辑移到Web Worker：
```typescript
const worker = new Worker('validator.worker.js');

worker.postMessage({ nodes, edges });
worker.onmessage = (e) => {
  setValidationErrors(e.data.errors);
};
```

这样主线程不会被阻塞，UI保持响应。

#### 3. 增量校验
目前每次修改都会重新校验所有节点。可以改为：
- 只校验变化的节点及其相邻节点
- 使用脏标记（Dirty Flag）模式跟踪变化
- 缓存校验结果

#### 4. IndexedDB 持久化
对于大型流程：
- 将节点数据存储到IndexedDB
- 按需加载和卸载节点
- 实现自动保存和恢复

#### 5. 分层渲染
将节点分为多个层级：
```typescript
// 活跃层：用户正在编辑的节点
// 静态层：不经常修改的节点
// 背景层：仅用于展示的节点

const layers = {
  active: activeNodes,    // 使用 SVG 高保真渲染
  static: staticNodes,    // 使用 Canvas 静态渲染
  background: bgNodes     // 使用低分辨率渲染
};
```


## Q&A

**Q1: 这个DSL能不能编译成PLC代码？**

A: 理论上可以。DSL已经将控制逻辑抽象为结构化的JSON，下一步可以编写一个代码生成器，将JSON转换为Ladder Logic（梯形图）或Structured Text（结构化文本）等PLC编程语言。这是一个很好的扩展方向。

**Q2: 为什么选择React Flow而不是自己实现图形编辑器？**

A: React Flow是一个成熟的、性能优化过的图形编辑框架，提供了拖拽、缩放、连线等基础功能。我的重点是实现化工领域的业务逻辑和DSL设计，而不是重复造轮子。站在巨人的肩膀上，可以将更多精力放在领域建模上。

**Q3: 校验规则如果需要扩展怎么办？**

A: 校验规则采用了**规则引擎**的设计模式。所有规则都定义在`NODE_COMPATIBILITY_RULES`数组中，添加新规则只需要：
```typescript
NODE_COMPATIBILITY_RULES.push({
  sourceType: 'device',
  targetType: 'sensor',
  allowed: false,
  reason: '新的业务规则...'
});
```
非常容易扩展，符合开闭原则（对扩展开放，对修改关闭）。
