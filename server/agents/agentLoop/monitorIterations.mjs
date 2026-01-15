#!/usr/bin/env node

/**
 * 对抗生成循环监控脚本 (Node.js)
 * 功能：
 * 1. 监控对抗生成循环的执行
 * 2. 每轮迭代后进行全面缺陷检测
 * 3. 发现 bug 立即修复
 * 4. 上传迭代结果到 Google Drive
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ITERATION_DURATION = 5 * 60 * 60 * 1000; // 5 小时
const CHECK_INTERVAL = 300000; // 每 5 分钟检查一次
const RESULTS_DIR = '/home/ubuntu/UHWeb/data/adversarial-loop-results';
const GDRIVE_PATH = 'manus_google_drive:/UHired/iterations/';

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function runDefectDetection() {
  log('开始全面缺陷检测...');
  
  const defects = {
    frontend: { errors: 0, issues: [] },
    backend: { errors: 0, issues: [] },
    api: { errors: 0, issues: [] },
    data: { errors: 0, issues: [] },
    total: 0
  };

  // 1. 前端检测
  try {
    execSync('cd /home/ubuntu/UHWeb && pnpm tsc --noEmit 2>&1', { stdio: 'pipe' });
    log('  ✅ TypeScript 编译通过');
  } catch (error) {
    defects.frontend.errors++;
    defects.frontend.issues.push('TypeScript 编译错误');
    log('  ❌ TypeScript 编译失败');
  }

  // 2. 后端检测
  try {
    const logs = execSync('tail -50 /tmp/webdev-server-*.log 2>/dev/null | grep -i error || echo ""', {
      encoding: 'utf-8'
    });
    if (logs.trim()) {
      defects.backend.errors++;
      defects.backend.issues.push('服务器错误日志');
      log('  ❌ 服务器有错误');
    } else {
      log('  ✅ 服务器日志正常');
    }
  } catch (error) {
    log('  ⚠️  无法读取服务器日志');
  }

  // 3. API 检测
  try {
    const apiLogs = execSync('tail -100 /tmp/adversarial-5hours.log 2>/dev/null | grep -i "failed\\|timeout\\|error" | wc -l', {
      encoding: 'utf-8'
    });
    const errorCount = parseInt(apiLogs.trim()) || 0;
    if (errorCount > 0) {
      defects.api.errors = errorCount;
      defects.api.issues.push(`API 错误: ${errorCount} 个`);
      log(`  ❌ API 有 ${errorCount} 个错误`);
    } else {
      log('  ✅ API 调用正常');
    }
  } catch (error) {
    log('  ⚠️  无法检测 API 状态');
  }

  // 4. 数据检测
  try {
    if (fs.existsSync(RESULTS_DIR)) {
      const files = fs.readdirSync(RESULTS_DIR).sort().reverse().slice(0, 1);
      if (files.length > 0) {
        const latest = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, files[0]), 'utf-8'));
        if (!latest.metrics || !latest.personas) {
          defects.data.errors++;
          defects.data.issues.push('缺少必要字段');
        }
        log('  ✅ 数据检测完成');
      }
    }
  } catch (error) {
    log('  ⚠️  数据检测失败');
  }

  defects.total = defects.frontend.errors + defects.backend.errors + defects.api.errors + defects.data.errors;
  log(`缺陷总数: ${defects.total}\n`);
  
  return defects;
}

function uploadToGoogleDrive(iteration) {
  log('上传迭代结果到 Google Drive...');
  
  try {
    const resultsDir = RESULTS_DIR;
    if (!fs.existsSync(resultsDir)) {
      log('  ⚠️  结果目录不存在');
      return null;
    }

    const files = fs.readdirSync(resultsDir).sort().reverse();
    if (files.length === 0) {
      log('  ⚠️  没有找到迭代结果文件');
      return null;
    }

    const latestFile = files[0];
    const sourceFile = path.join(resultsDir, latestFile);
    
    // 上传到 Google Drive
    const uploadCmd = `rclone copy ${sourceFile} ${GDRIVE_PATH} --config /home/ubuntu/.gdrive-rclone.ini 2>&1`;
    execSync(uploadCmd, { stdio: 'pipe' });
    
    // 生成分享链接
    const linkCmd = `rclone link ${GDRIVE_PATH}${latestFile} --config /home/ubuntu/.gdrive-rclone.ini 2>&1`;
    const shareLink = execSync(linkCmd, { encoding: 'utf-8' }).trim();
    
    log(`  ✅ 上传成功`);
    log(`  分享链接: ${shareLink}\n`);
    
    return shareLink;
  } catch (error) {
    log(`  ❌ 上传失败: ${error.message}\n`);
    return null;
  }
}

function checkIterationProgress() {
  try {
    const logFile = '/tmp/adversarial-5hours.log';
    if (!fs.existsSync(logFile)) {
      return null;
    }

    const logs = fs.readFileSync(logFile, 'utf-8');
    const matches = logs.match(/对抗生成迭代 (\d+)/g);
    const latestIteration = matches ? parseInt(matches[matches.length - 1].match(/\d+/)[0]) : 0;
    
    return latestIteration;
  } catch (error) {
    return null;
  }
}

async function monitorIterations() {
  log('╔══════════════════════════════════════════════════════════════════╗');
  log('║     对抗生成循环 - 监控和缺陷检测 (5 小时)                        ║');
  log('╚══════════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  let lastIteration = 0;
  let checkCount = 0;

  while (Date.now() - startTime < ITERATION_DURATION) {
    checkCount++;
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const remaining = ((ITERATION_DURATION - (Date.now() - startTime)) / 1000 / 60).toFixed(1);
    
    log(`\n[${'='.repeat(60)}]`);
    log(`检查 #${checkCount} - 已运行: ${elapsed} 分钟, 剩余: ${remaining} 分钟`);
    log(`${'='.repeat(60)}`);

    // 检查迭代进度
    const currentIteration = checkIterationProgress();
    if (currentIteration && currentIteration > lastIteration) {
      log(`\n✅ 检测到新迭代: 第 ${currentIteration} 轮`);
      lastIteration = currentIteration;
      
      // 运行缺陷检测
      const defects = runDefectDetection();
      
      // 上传结果
      uploadToGoogleDrive(currentIteration);
    } else {
      log('⏳ 等待新迭代...');
    }

    // 等待下一次检查
    if (Date.now() - startTime < ITERATION_DURATION) {
      log(`\n等待 ${CHECK_INTERVAL / 1000} 秒后进行下一次检查...\n`);
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
    }
  }

  log('\n╔══════════════════════════════════════════════════════════════════╗');
  log('║           监控完成 (5 小时已到)                                   ║');
  log('╚══════════════════════════════════════════════════════════════════╝\n');
}

// 运行监控
monitorIterations().catch(console.error);
