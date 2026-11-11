# E2B Sandbox MCP Server

> 🚀 **AI-Powered Computer Use Through Secure Cloud Sandboxes**

A powerful Model Context Protocol (MCP) server that enables AI assistants to create, control, and interact with virtual desktop environments through E2B's secure cloud sandboxes. Perfect for AI agents that need to perform computer tasks, web automation, or visual testing.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![E2B](https://img.shields.io/badge/E2B-Sandbox-blue)](https://e2b.dev/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green)](https://modelcontextprotocol.io/)

## ✨ Features

- 🖥️ **Virtual Desktop Management**: Create Ubuntu 22.04 desktop sandboxes in seconds
- 🎮 **Complete Computer Control**: Click, type, drag, scroll, and keyboard shortcuts
- 📺 **Live VNC Streaming**: Real-time desktop viewing through secure web streams
- 📸 **Screenshot Capture**: AI-ready desktop screenshots for vision processing
- 🔄 **Lifecycle Management**: Automatic cleanup and resource management
- 🛡️ **Secure Isolation**: Completely isolated environments with no host access
- 🔧 **MCP Standard**: Fully compatible with Model Context Protocol
- ⚡ **High Performance**: Optimized for AI workloads and real-time interaction

## 🎯 Use Cases

- **AI Agent Automation**: Let AI agents perform complex computer tasks
- **Web Scraping & Testing**: Automated browser interactions and testing
- **Application Testing**: Visual regression testing and UI automation
- **Data Entry Automation**: Automate form filling and data processing
- **Research & Analysis**: AI-powered information gathering from desktop apps
- **Training Data Generation**: Capture interaction sequences for ML training

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [E2B API Key](https://e2b.dev/) (Free tier available)
- [TypeScript](https://www.typescriptlang.org/) knowledge (for development)

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/your-username/e2b-sandbox-mcp.git
cd e2b-sandbox-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### 2. Configuration

Create a `.env` file or set environment variables:

```env
E2B_API_KEY=your_e2b_api_key_here
```

**Get your E2B API key:**

1. Visit [E2B Dashboard](https://e2b.dev/dashboard)
2. Sign up/log in
3. Navigate to "API Keys"
4. Create a new API key

### 3. Running the Server

```bash
# Start the MCP server
npm start

# Development mode with hot reload
npm run dev

# Debug mode
npm run inspect
```

### 4. MCP Client Integration

Add to your MCP configuration file (e.g., `mcp.json`):

```json
{
  "mcpServers": {
    "e2b-sandbox": {
      "command": "node",
      "args": ["/PATH_TO/e2b-sandbox-mcp/dist/index.js"],
      "env": {
        "OPEN_AI_API_KEY": "YOUR_OPEN_AI_API_KEY",
        "E2B_API_KEY": "YOUR_E2B_API_KEY"
      }
    }
  }
}
```

## 📚 API Reference

### MCP Tools

#### `create_sandbox`

Creates a new E2B desktop sandbox instance.

**Parameters:**

- `resolution` (optional): Array of [width, height]. Default: `[1920, 1080]`
- `timeout` (optional): Timeout in milliseconds. Default: `600000` (10 minutes)

**Example:**

```json
{
  "name": "create_sandbox",
  "arguments": {
    "resolution": [1920, 1080],
    "timeout": 600000
  }
}
```

**Response:**

```json
{
  "sandboxId": "imy7xu1l122itq99pp4rn-9886af4b",
  "streamUrl": "https://6080-sandbox-id.e2b.app/vnc.html?autoconnect=true&resize=scale",
  "resolution": [1920, 1080],
  "status": "created",
  "message": "Sandbox created successfully"
}
```

#### `execute_computer_action`

Execute computer actions on the sandbox desktop.

**Parameters:**

- `sandboxId`: The sandbox ID to execute action on
- `action`: Action object with type and parameters

**Supported Actions:**

| Action Type    | Description                 | Parameters                             |
| -------------- | --------------------------- | -------------------------------------- |
| `click`        | Click at coordinates        | `x`, `y`, `button` (left/right/middle) |
| `double_click` | Double-click at coordinates | `x`, `y`, `button`                     |
| `type`         | Type text                   | `text`                                 |
| `keypress`     | Press keyboard keys         | `keys` (e.g., "Ctrl+c", "Return")      |
| `move`         | Move mouse cursor           | `x`, `y`                               |
| `scroll`       | Scroll vertically           | `scroll_y`, `x`, `y`                   |
| `drag`         | Drag from point A to B      | `path` (array of {x, y} points)        |
| `screenshot`   | Take screenshot             | None                                   |

**Examples:**

```json
// Click example
{
  "name": "execute_computer_action",
  "arguments": {
    "sandboxId": "sandbox-id",
    "action": {
      "type": "click",
      "x": 100,
      "y": 200,
      "button": "left"
    }
  }
}

// Type text example
{
  "name": "execute_computer_action",
  "arguments": {
    "sandboxId": "sandbox-id",
    "action": {
      "type": "type",
      "text": "Hello, World!"
    }
  }
}

// Keyboard shortcut example
{
  "name": "execute_computer_action",
  "arguments": {
    "sandboxId": "sandbox-id",
    "action": {
      "type": "keypress",
      "keys": "Ctrl+c"
    }
  }
}

// Drag example
{
  "name": "execute_computer_action",
  "arguments": {
    "sandboxId": "sandbox-id",
    "action": {
      "type": "drag",
      "path": [
        {"x": 100, "y": 100},
        {"x": 200, "y": 200}
      ]
    }
  }
}
```

#### `get_stream_url`

Get the VNC stream URL for viewing the desktop.

```json
{
  "name": "get_stream_url",
  "arguments": {
    "sandboxId": "sandbox-id"
  }
}
```

#### `get_screenshot`

Capture a screenshot of the desktop.

```json
{
  "name": "get_screenshot",
  "arguments": {
    "sandboxId": "sandbox-id"
  }
}
```

**Response:**

```json
{
  "screenshot": "base64-encoded-image-data",
  "format": "png",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### `cleanup_sandbox`

Clean up and destroy a sandbox instance.

```json
{
  "name": "cleanup_sandbox",
  "arguments": {
    "sandboxId": "sandbox-id"
  }
}
```

#### `list_sandboxes`

List all active sandbox instances.

```json
{
  "name": "list_sandboxes",
  "arguments": {}
}
```

## 🏗️ Integration Examples

### Basic Usage

```typescript
import { MCPClient } from "@modelcontextprotocol/sdk/client/index.js";

class ComputerUseClient {
  private mcpClient: MCPClient;

  async createDesktopSession() {
    // Create a new sandbox
    const result = await this.mcpClient.callTool({
      name: "create_sandbox",
      arguments: {
        resolution: [1920, 1080],
        timeout: 600000,
      },
    });

    const response = JSON.parse(result.content[0].text);
    return {
      sandboxId: response.sandboxId,
      streamUrl: response.streamUrl,
    };
  }

  async automateWebBrowsing(sandboxId: string, url: string) {
    // Open Firefox browser
    await this.mcpClient.callTool({
      name: "execute_computer_action",
      arguments: {
        sandboxId,
        action: { type: "keypress", keys: "Meta+t" },
      },
    });

    // Type URL
    await this.mcpClient.callTool({
      name: "execute_computer_action",
      arguments: {
        sandboxId,
        action: { type: "type", text: url },
      },
    });

    // Press Enter
    await this.mcpClient.callTool({
      name: "execute_computer_action",
      arguments: {
        sandboxId,
        action: { type: "keypress", keys: "Return" },
      },
    });
  }
}
```

### React Frontend Integration

```tsx
import React, { useState, useEffect } from "react";

interface DesktopViewerProps {
  streamUrl: string;
}

function DesktopViewer({ streamUrl }: DesktopViewerProps) {
  return (
    <div className="desktop-container">
      <iframe
        src={streamUrl}
        className="w-full h-full border-0"
        allow="clipboard-read; clipboard-write; fullscreen"
        title="E2B Desktop Sandbox"
        style={{ minHeight: "600px" }}
      />
    </div>
  );
}

function App() {
  const [sandboxData, setSandboxData] = useState(null);

  const createSandbox = async () => {
    // Your MCP client call here
    const response = await mcpClient.callTool({
      name: "create_sandbox",
      arguments: { resolution: [1920, 1080] },
    });
    setSandboxData(JSON.parse(response.content[0].text));
  };

  return (
    <div className="app">
      <button onClick={createSandbox} className="btn-primary">
        Create Desktop Sandbox
      </button>

      {sandboxData && <DesktopViewer streamUrl={sandboxData.streamUrl} />}
    </div>
  );
}
```

### AI Agent Integration

```typescript
class AIComputerAgent {
  constructor(private mcpClient: MCPClient) {}

  async performTask(sandboxId: string, instruction: string) {
    // 1. Take screenshot to understand current state
    const screenshot = await this.mcpClient.callTool({
      name: "get_screenshot",
      arguments: { sandboxId },
    });

    // 2. Process with AI to determine next actions
    const actions = await this.analyzeAndPlan(
      instruction,
      screenshot.content[0].text
    );

    // 3. Execute planned actions
    for (const action of actions) {
      await this.mcpClient.callTool({
        name: "execute_computer_action",
        arguments: { sandboxId, action },
      });

      // Small delay between actions
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  private async analyzeAndPlan(instruction: string, screenshot: string) {
    // Your AI logic here (OpenAI, Anthropic, etc.)
    // Return array of computer actions
    return [
      { type: "click", x: 100, y: 200, button: "left" },
      { type: "type", text: "Hello World" },
    ];
  }
}
```

## 🏛️ Architecture

### System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Assistant  │    │  MCP Client     │    │  Your App       │
│                 │    │                 │    │                 │
│  • Claude       │◄──►│  • Tool Calls   │◄──►│  • Frontend     │
│  • GPT-4        │    │  • Responses    │    │  • Backend      │
│  • Custom       │    │                 │    │  • API          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                 │
                                 ▼
                    ┌─────────────────┐
                    │ E2B Sandbox MCP │
                    │     Server      │
                    │                 │
                    │ • Sandbox Mgmt  │
                    │ • Action Exec   │
                    │ • Stream URLs   │
                    │ • Screenshots   │
                    └─────────────────┘
                                 │
                                 ▼
                    ┌─────────────────┐
                    │  E2B Cloud      │
                    │   Sandboxes     │
                    │                 │
                    │ • Ubuntu 22.04  │
                    │ • VNC Streaming │
                    │ • Isolation     │
                    │ • Auto Cleanup  │
                    └─────────────────┘
```

### Key Components

- **MCP Server**: Handles tool calls and manages E2B API interactions
- **Sandbox Manager**: Creates, tracks, and cleans up sandbox instances
- **Computer Use Tools**: Executes mouse, keyboard, and system actions
- **Stream Manager**: Provides VNC URLs for real-time desktop viewing
- **Action Executor**: Translates MCP actions to E2B desktop commands

## 📁 Project Structure

```
e2b-sandbox-mcp/
├── src/
│   ├── index.ts              # Main MCP server entry point
│   ├── sandbox-manager.ts    # E2B sandbox lifecycle management
│   └── computer-use-tools.ts # Computer action implementations
├── examples/
│   ├── simple-test.js        # Basic testing script
│   ├── client-integration.ts # Advanced MCP client example
│   └── web-integration/      # Web app integration example
├── dist/                     # Compiled JavaScript output
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## 🧪 Testing

### Run Examples

```bash
# Test basic functionality
npm test

# Run web integration example
cd examples/web-integration
npm install
npm start
```

### Manual Testing

```bash
# Start MCP server in debug mode
npm run inspect

# In another terminal, test tool calls
node examples/simple-test.js
```

## 🔧 Development

### Setup Development Environment

```bash
# Clone and setup
git clone https://github.com/your-username/e2b-sandbox-mcp.git
cd e2b-sandbox-mcp

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your E2B API key

# Start development server
npm run dev
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm run inspect` - Start with Node.js debugger
- `npm test` - Run test scripts
- `npm run setup` - Setup and test installation

### Adding New Features

1. **New Computer Actions**: Add to `src/computer-use-tools.ts`
2. **Enhanced Management**: Modify `src/sandbox-manager.ts`
3. **API Extensions**: Update `src/index.ts` with new tool definitions

## 🐛 Troubleshooting

### Common Issues

| Problem                  | Solution                                                  |
| ------------------------ | --------------------------------------------------------- |
| `E2B_API_KEY not found`  | Set environment variable or pass `--e2b-api-key` argument |
| `Sandbox creation fails` | Check E2B API key validity and account quota              |
| `Actions not executing`  | Verify sandbox is active with `list_sandboxes`            |
| `Stream URL not working` | Ensure sandbox supports VNC (desktop template)            |
| `High memory usage`      | Implement proper sandbox cleanup after use                |

### Debug Mode

```bash
# Enable detailed logging
DEBUG=* npm run dev

# MCP-specific debugging
MCP_DEBUG=1 npm start

# Node.js inspector
npm run inspect
# Then open chrome://inspect in Chrome
```

### API Limits

- **E2B Free Tier**: 100 hours/month sandbox usage
- **Concurrent Sandboxes**: 5 active instances (Free), more on paid plans
- **Timeout Limits**: Default 10 minutes, configurable up to 24 hours

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md).

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow existing code formatting (Prettier)
- Add JSDoc comments for public APIs
- Include error handling and validation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [E2B Documentation](https://e2b.dev/docs)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [E2B Desktop SDK](https://github.com/e2b-dev/desktop)
- [Issue Tracker](https://github.com/your-username/e2b-sandbox-mcp/issues)

## 🙏 Acknowledgments

- [E2B](https://e2b.dev/) for providing the cloud sandbox infrastructure
- [Anthropic](https://anthropic.com/) for the Model Context Protocol specification
- The open-source community for various tools and libraries used in this project

---

<div align="center">

**[⭐ Star this repo](https://github.com/your-username/e2b-sandbox-mcp)** if you find it useful!

Made with ❤️ for the AI automation community

</div>


## 🧪 Kaggle Tools

The HTTP MCP server also exposes Kaggle's API. Configure credentials on the
server (never put them in notebook code or commit them to Git):

```env
# Recommended: Kaggle API token
KAGGLE_API_TOKEN=KGAT_your_token

# Legacy alternative:
# KAGGLE_USERNAME=your_kaggle_username
# KAGGLE_KEY=your_legacy_api_key
```

Available Kaggle tools:

| Tool | Purpose |
| --- | --- |
| `kaggle_status` | Check credential configuration without revealing secrets |
| `kaggle_list_datasets`, `kaggle_get_dataset`, `kaggle_list_dataset_files` | Discover datasets and inspect their metadata/files |
| `kaggle_dataset_download_info` | Get the authenticated download endpoint for a dataset |
| `kaggle_list_kernels`, `kaggle_pull_kernel`, `kaggle_kernel_status`, `kaggle_push_kernel` | Discover, pull, inspect, and publish notebooks |
| `kaggle_get_kernel_output` | Retrieve the latest notebook output response |
| `kaggle_list_competitions` | Search competitions |
| `kaggle_list_competition_files` | List competition data files |
| `kaggle_list_competition_submissions` | Inspect your submissions |
| `kaggle_view_competition_leaderboard` | View a competition leaderboard |

Competition data access and submissions remain subject to Kaggle's rules,
account permissions, and competition-specific requirements. Kaggle applies
dynamic rate limits; avoid tight polling loops and retry HTTP 429 responses
after a pause.

The MCP endpoint can serve Kaggle-only deployments without an E2B key.
E2B desktop/code-interpreter tools still require `E2B_API_KEY`.

For current authentication and API behavior, see the
[Kaggle API documentation](https://www.kaggle.com/docs/api) and the
[official Kaggle CLI documentation](https://github.com/Kaggle/kaggle-cli).
