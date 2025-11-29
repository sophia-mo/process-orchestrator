# 低代码工艺流程编排器

一个基于 React + TypeScript 的可视化工艺流程编排器，专为化工控制逻辑设计。

## 核心特性

- **可视化拖拽画布**：基于 React Flow 实现的专业级流程编辑器
- **AST 转换引擎**：将图形拓扑实时转换为可执行的 JSON DSL
- **智能逻辑校验**：防止非法连接和循环依赖
- **双向绑定**：图形 ↔ JSON 实时同步
- **内置示例**：高液位自动停泵等化工场景

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

## 使用方法

1. 从左侧面板拖拽节点到画布
2. 连接节点创建控制逻辑
3. 右侧实时查看生成的 AST 和规则
4. 点击 "Load Example" 加载预设示例

## 节点类型

- **设备节点**：Tank, Pump, Valve, Electrolyzer
- **传感器节点**：Level, Temperature, Pressure, Flow Rate
- **逻辑节点**：AND, OR, NOT, >, <, Delay
- **执行器节点**：Start, Stop, Open, Close

## 技术栈

- React 18 + TypeScript
- React Flow (@xyflow/react)
- Vite
- AST 转换引擎（自研）
- 图论校验算法

## 项目结构

```
src/
├── components/
│   ├── ProcessEditor.tsx    # 主编辑器
│   └── nodes/              # 自定义节点组件
├── types/
│   └── dsl.ts              # DSL 类型定义
└── utils/
    ├── astConverter.ts     # AST 转换引擎（核心）
    └── validator.ts        # 逻辑校验系统
```

## 示例：高液位自动停泵

```
[Tank A] → [Level Sensor] → [> 80] → [Stop] → [Pump C]
```

生成的 DSL：
```json
{
  "condition": {
    "type": "comparison",
    "operator": ">",
    "left": { "type": "sensor", "sensorId": "level_sensor" },
    "right": { "type": "constant", "value": 80 }
  },
  "action": {
    "type": "actuator",
    "actuatorType": "stop",
    "targetId": "pump_c"
  }
}
```

## 详细文档

查看 `PROJECT_DOCUMENTATION.md` 了解：
- 完整架构设计
- AST 转换算法
- 性能优化策略
- 扩展开发指南

## License

MIT
