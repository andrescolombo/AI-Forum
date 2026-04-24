

class OptimizationTester {
  constructor() {
    this.testResults = {
      contentExtraction: {},
      siteDetection: {},
      exportPerformance: {}
    };
  }

  
  async testContentExtraction() {
    console.log('🧪 开始测试内容提取优化...');
    
    const testCases = [
      {
        name: '高质量内容',
        content: '根据您的问题，我建议采用以下方案：\n\n1. 首先分析需求\n2. 然后制定计划\n3. 最后Execute实施\n\n这样可以确保项目的Successful。',
        expected: true
      },
      {
        name: '低质量内容',
        content: '好的',
        expected: false
      },
      {
        name: '包含代码的内容',
        content: '以下是代码示例：\n\n```javascript\nfunction test() {\n  return "hello";\n}\n```\n\n这个函数很简单。',
        expected: true
      },
      {
        name: '空内容',
        content: '',
        expected: false
      }
    ];

    let passedTests = 0;
    const startTime = performance.now();

    for (const testCase of testCases) {
      try {
        
        const result = this.isHighQualityContent(testCase.content);
        const passed = result === testCase.expected;
        
        if (passed) {
          passedTests++;
          console.log(`✅ ${testCase.name}: 通过`);
        } else {
          console.log(`❌ ${testCase.name}: Failed (期望: ${testCase.expected}, 实际: ${result})`);
        }
      } catch (error) {
        console.error(`❌ ${testCase.name}: 错误 -`, error);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    this.testResults.contentExtraction = {
      passedTests,
      totalTests: testCases.length,
      successRate: (passedTests / testCases.length * 100).toFixed(2) + '%',
      executionTime: totalTime.toFixed(2) + 'ms'
    };

    console.log(`📊 内容提取测试Completed: ${passedTests}/${testCases.length} 通过, 耗时 ${totalTime.toFixed(2)}ms`);
  }

  
  async testSiteDetection() {
    console.log('🧪 开始测试Site检测优化...');
    
    const testDomains = [
      'chat.openai.com',
      'claude.ai',
      'gemini.google.com',
      'x.ai',
      'unknown-site.com'
    ];

    let successfulDetections = 0;
    const startTime = performance.now();

    for (const domain of testDomains) {
      try {
        
        const result = await this.simulateSiteDetection(domain);
        if (result) {
          successfulDetections++;
          console.log(`✅ ${domain}: 检测Successful`);
        } else {
          console.log(`⚠️ ${domain}: 未检测到`);
        }
      } catch (error) {
        console.error(`❌ ${domain}: 检测Failed -`, error);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    this.testResults.siteDetection = {
      successfulDetections,
      totalDomains: testDomains.length,
      successRate: (successfulDetections / testDomains.length * 100).toFixed(2) + '%',
      executionTime: totalTime.toFixed(2) + 'ms'
    };

    console.log(`📊 Site检测测试Completed: ${successfulDetections}/${testDomains.length} Successful, 耗时 ${totalTime.toFixed(2)}ms`);
  }

  
  async testExportPerformance() {
    console.log('🧪 开始测试导出性能优化...');
    
    const mockResponses = [
      {
        siteName: 'ChatGPT',
        content: '这是一个高质量的AI回答，包含详细的解释和建议。',
        quality: 'high',
        length: 100
      },
      {
        siteName: 'Claude',
        content: '简短回答',
        quality: 'low',
        length: 10
      }
    ];

    const formats = ['markdown', 'html', 'txt'];
    const startTime = performance.now();

    for (const format of formats) {
      try {
        const exportContent = this.generateExportContent(mockResponses, format);
        console.log(`✅ ${format} 格式导出Successful，长度: ${exportContent.length}`);
      } catch (error) {
        console.error(`❌ ${format} 格式导出Failed:`, error);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    this.testResults.exportPerformance = {
      formats: formats.length,
      executionTime: totalTime.toFixed(2) + 'ms',
      averageTimePerFormat: (totalTime / formats.length).toFixed(2) + 'ms'
    };

    console.log(`📊 导出性能测试Completed，耗时 ${totalTime.toFixed(2)}ms`);
  }

  
  isHighQualityContent(content) {
    if (!content || content.length < 10) return false;
    
    const aiIndicators = [
      '回答', '回复', 'response', 'answer',
      '根据', '基于', '建议', '推荐',
      '分析', '总结', '解释', '说明',
      '首先', '其次', '最后', '总结',
      '我认为', '建议', '推荐', '可以',
      '以下', '如下', '具体', '详细'
    ];
    
    const hasAIIndicator = aiIndicators.some(indicator => 
      content.toLowerCase().includes(indicator.toLowerCase())
    );
    
    const hasStructure = content.includes('\n') || content.includes('。') || content.includes('.');
    const hasCodeOrList = content.includes('```') || content.includes('- ') || content.includes('1. ');
    const hasCompleteSentences = content.includes('。') || content.includes('!') || content.includes('?');
    
    return hasAIIndicator && (hasStructure || hasCodeOrList) && hasCompleteSentences;
  }

  
  async simulateSiteDetection(domain) {
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const knownSites = ['chat.openai.com', 'claude.ai', 'gemini.google.com', 'x.ai'];
        resolve(knownSites.includes(domain));
      }, Math.random() * 10); 
    });
  }

  
  generateExportContent(responses, format) {
    const timestamp = new Date().toISOString();
    
    switch (format) {
      case 'markdown':
        return responses.map(r => 
          `## ${r.siteName} 回答\n\n${r.content}\n\n---\n`
        ).join('\n');
      
      case 'html':
        return responses.map(r => 
          `<h2>${r.siteName} 回答</h2>\n<p>${r.content}</p>\n<hr>\n`
        ).join('\n');
      
      case 'txt':
        return responses.map(r => 
          `${r.siteName} 回答:\n${r.content}\n\n${'='.repeat(50)}\n`
        ).join('\n');
      
      default:
        throw new Error(`不支持的格式: ${format}`);
    }
  }

  
  async runAllTests() {
    console.log('🚀 开始运行优化效果测试...\n');
    
    await this.testContentExtraction();
    console.log('');
    
    await this.testSiteDetection();
    console.log('');
    
    await this.testExportPerformance();
    console.log('');
    
    this.generateReport();
  }

  
  generateReport() {
    console.log('📋 优化效果测试报告');
    console.log('='.repeat(50));
    
    console.log('\n🔍 内容提取优化:');
    console.log(`  Successful率: ${this.testResults.contentExtraction.successRate}`);
    console.log(`  Execute时间: ${this.testResults.contentExtraction.executionTime}`);
    
    console.log('\n🎯 Site检测优化:');
    console.log(`  Successful率: ${this.testResults.siteDetection.successRate}`);
    console.log(`  Execute时间: ${this.testResults.siteDetection.executionTime}`);
    
    console.log('\n📤 导出性能优化:');
    console.log(`  支持格式: ${this.testResults.exportPerformance.formats}`);
    console.log(`  总Execute时间: ${this.testResults.exportPerformance.executionTime}`);
    console.log(`  平均每格式: ${this.testResults.exportPerformance.averageTimePerFormat}`);
    
    console.log('\n✅ 所有测试Completed！');
  }
}


if (typeof window !== 'undefined') {
  const tester = new OptimizationTester();
  tester.runAllTests().catch(console.error);
} else {
  console.log('❌ 此测试需要在浏览器环境中运行');
}
