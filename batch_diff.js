// 批量处理HTML差异比较工具

// 导入必要的Node.js模块
const fs = require('fs');
const path = require('path');

// 定义文件夹路径
const INPUT1_FOLDER = './input1';
const INPUT2_FOLDER = './input2';
const OUTPUT_FOLDER = './output';

// HtmlDiff2类的定义，从htmldiff2.js中复制过来
class HtmlDiff2 {
    constructor() {
        this.ignore_tag = [];
        this.Diff_Timeout = 0;
    }

    diff_launch(html1, html2) {
        const text1 = this.convertTextFromHtml(html1);
        const text2 = this.convertTextFromHtml(html2);

        // 由于我们不能直接使用diff_match_patch库，这里使用一个简化的差异比较算法
        const diff = this.simpleDiff(text1, text2);
        const time = Date.now(); // 模拟时间计算

        const diffHtml = this.restoreToHtml(html2, diff);
        return { time, diffHtml };
    }

    // 简化的差异比较算法
    simpleDiff(text1, text2) {
        const diff = [];
        let i = 0, j = 0;
        
        while (i < text1.length || j < text2.length) {
            if (i < text1.length && j < text2.length && text1[i] === text2[j]) {
                // 相同的字符
                let k = 0;
                while (i + k < text1.length && j + k < text2.length && text1[i + k] === text2[j + k]) {
                    k++;
                }
                diff.push([0, text1.substring(i, i + k)]);
                i += k;
                j += k;
            } else if (i < text1.length && j < text2.length) {
                // 不同的字符
                let k1 = 1, k2 = 1;
                // 寻找最长的不匹配序列
                while (i + k1 < text1.length && j + k2 < text2.length && text1[i + k1] !== text2[j + k2]) {
                    k1++;
                    k2++;
                }
                diff.push([-1, text1.substring(i, i + k1)]); // 删除
                diff.push([1, text2.substring(j, j + k2)]);  // 新增
                i += k1;
                j += k2;
            } else if (i < text1.length) {
                // 只有text1有字符
                diff.push([-1, text1.substring(i)]);
                i = text1.length;
            } else {
                // 只有text2有字符
                diff.push([1, text2.substring(j)]);
                j = text2.length;
            }
        }
        
        return diff;
    }

    restoreToHtml(originalHtml, diffResultList) {
        let diffHtml = '';
        while (true) {
            let { tag, text } = this.getOneTextFromHtml(originalHtml);
            diffHtml += tag;
            originalHtml = originalHtml.substr(tag.length + text.length);
            
            for (let i = 0, len = diffResultList.length; i < len; i++) {
                const diffType = diffResultList[i][0];
                let diffText = diffResultList[i][1];
                
                if (diffType === -1) {
                    diffHtml += this.formatText(diffType, diffText);
                    diffResultList.splice(i, 1);
                    i--;
                    len--;
                    continue;
                }
                
                if (diffText === text) {
                    diffHtml += this.formatText(diffType, diffText);
                    diffResultList.splice(i, 1);
                    break;
                }
                
                if (diffText.length > text.length) {
                    diffHtml += this.formatText(diffType, text);
                    diffResultList[i][1] = diffText.substr(text.length);
                    break;
                }
                
                if (text.length > diffText.length) {
                    diffHtml += this.formatText(diffType, diffText);
                    text = text.substr(diffText.length);
                    diffResultList.splice(i, 1);
                    i--;
                    len--;
                }
            }
            
            if (!originalHtml || !diffResultList || diffResultList.length <= 0) {
                break;
            }
        }
        
        for (let i = 0, len = diffResultList.length; i < len; i++) {
            diffHtml += this.formatText(diffResultList[i][0], diffResultList[i][1]);
        }
        
        return diffHtml + originalHtml;
    }

    convertTextFromHtml(html) {
        let text = '';
        let tagFlag = false;
        this.ignore_tag.map(item => {
            item.flag = false;
        });
        
        for (let i = 0, len = html.length; i < len; i++) {
            if (!tagFlag && html[i] === '<') {
                tagFlag = true;
                this.ignore_tag.map(item => {
                    if (html.substr(i + 1, item.openTag.length) == item.openTag) {
                        item.flag = true;
                    }
                });
            } else if (tagFlag && html[i] === '>') {
                tagFlag = false;
                this.ignore_tag.map(item => {
                    if (item.flag && html.substring(i - item.closeTag.length, i) == item.closeTag) {
                        item.flag = false;
                    }
                });
                continue;
            }
            
            let notDiffFlag = false;
            this.ignore_tag.map(item => {
                if (item.flag) {
                    notDiffFlag = true;
                }
            });
            
            if (!tagFlag && !notDiffFlag) {
                text += html[i];
            }
        }
        
        return text;
    }

    getOneTextFromHtml(html) {
        let tag = '';
        let text = '';
        let tagFlag = false;
        this.ignore_tag.map(item => {
            item.flag = false;
        });
        
        for (let i = 0, len = html.length; i < len; i++) {
            if (!tagFlag && html[i] === '<') {
                tagFlag = true;
                if (text) {
                    return { tag, text };
                }
                this.ignore_tag.map(item => {
                    if (html.substr(i + 1, item.openTag.length) == item.openTag) {
                        item.flag = true;
                    }
                });
            } else if (tagFlag && html[i] === '>') {
                tagFlag = false;
                tag += html[i];
                this.ignore_tag.map(item => {
                    if (item.flag && html.substring(i - item.closeTag.length, i) == item.closeTag) {
                        item.flag = false;
                    }
                });
                continue;
            }
            
            let notDiffFlag = false;
            this.ignore_tag.map(item => {
                if (item.flag) {
                    notDiffFlag = true;
                }
            });
            
            if (!tagFlag && !notDiffFlag) {
                text += html[i];
            } else {
                tag += html[i];
            }
        }
        
        return { tag, text };
    }

    formatText(diffType, diffText) {
        if (diffType === 0) {
            return diffText;
        } else if (diffType === -1) {
            return '<del>' + diffText + '</del>';
        } else {
            return '<ins>' + diffText + '</ins>';
        }
    }
}

// 批量处理函数
function batchProcess() {
    try {
        // 确保输出文件夹存在
        if (!fs.existsSync(OUTPUT_FOLDER)) {
            fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
        }

        // 读取input1文件夹中的所有文件
        const files1 = fs.readdirSync(INPUT1_FOLDER);
        const files2 = fs.readdirSync(INPUT2_FOLDER);

        // 找出两个文件夹中共同的txt文件
        const commonFiles = files1.filter(file => 
            files2.includes(file) && path.extname(file) === '.txt'
        );

        console.log(`找到 ${commonFiles.length} 个共同的txt文件需要处理`);

        // 实例化HtmlDiff2
        const htmlDiff2 = new HtmlDiff2();

        // 处理每个共同文件
        commonFiles.forEach(file => {
            try {
                const filePath1 = path.join(INPUT1_FOLDER, file);
                const filePath2 = path.join(INPUT2_FOLDER, file);
                const outputPath = path.join(OUTPUT_FOLDER, file);

                // 读取文件内容
                const content1 = fs.readFileSync(filePath1, 'utf8');
                const content2 = fs.readFileSync(filePath2, 'utf8');

                // 执行差异比较
                const { time, diffHtml } = htmlDiff2.diff_launch(content1, content2);

                // 保存结果到输出文件夹
                fs.writeFileSync(outputPath, diffHtml, 'utf8');

                console.log(`处理文件 ${file} 完成，耗时: ${time}ms`);
            } catch (error) {
                console.error(`处理文件 ${file} 时出错:`, error.message);
            }
        });

        console.log('批量处理完成！');
    } catch (error) {
        console.error('批量处理过程中出错:', error.message);
    }
}

// 执行批量处理
batchProcess();