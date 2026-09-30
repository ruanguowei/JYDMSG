import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def create_modules_excel():
    wb = Workbook()
    
    # Define styles
    font_family = "Arial"
    
    # Colors
    header_fill_color = "2F5597"  # Deep blue
    sub_header_fill_color = "D9E1F2"  # Light blue
    zebra_fill_color = "F2F2F2"  # Light gray
    accent_fill_color = "FFF2CC"  # Very light orange/yellow
    
    title_font = Font(name=font_family, size=16, bold=True, color="1F497D")
    header_font = Font(name=font_family, size=11, bold=True, color="FFFFFF")
    bold_font = Font(name=font_family, size=10, bold=True)
    regular_font = Font(name=font_family, size=10)
    italic_font = Font(name=font_family, size=9, italic=True, color="595959")
    
    header_fill = PatternFill(start_color=header_fill_color, end_color=header_fill_color, fill_type="solid")
    sub_header_fill = PatternFill(start_color=sub_header_fill_color, end_color=sub_header_fill_color, fill_type="solid")
    zebra_fill = PatternFill(start_color=zebra_fill_color, end_color=zebra_fill_color, fill_type="solid")
    accent_fill = PatternFill(start_color=accent_fill_color, end_color=accent_fill_color, fill_type="solid")
    
    thin_border_side = Side(border_style="thin", color="D9D9D9")
    thin_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    
    double_bottom_border = Border(
        top=thin_border_side,
        bottom=Side(border_style="double", color="000000"),
        left=thin_border_side,
        right=thin_border_side
    )
    
    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
    align_right = Alignment(horizontal="right", vertical="center", wrap_text=True)
    
    # ----------------- SHEET 1: 看板 (Dashboard) -----------------
    ws_dash = wb.active
    ws_dash.title = "系统看板"
    ws_dash.views.sheetView[0].showGridLines = True
    
    # Title
    ws_dash["A1"] = "第三届全国大学生陶瓷艺术作品展系统"
    ws_dash["A1"].font = title_font
    ws_dash["A2"] = "系统功能模块开发明细与状态看板 (2026年度升级版)"
    ws_dash["A2"].font = italic_font
    
    # Stats Card Headers
    ws_dash["B4"] = "指标名称"
    ws_dash["C4"] = "统计数值"
    ws_dash["D4"] = "占比 / 说明"
    
    for col in ["B", "C", "D"]:
        cell = ws_dash[f"{col}4"]
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = align_center
        cell.border = thin_border
    
    # Stats Data Rows
    stats = [
        ("一级模块数", 4, "个"),
        ("二级模块数", 12, "个"),
        ("三级功能点总数", "=COUNTA(功能明细清单!D:D)-1", "基于开发清单统计"),
        ("已完成功能点", '=COUNTIF(功能明细清单!G:G, "已完成")', "核心业务功能已就绪"),
        ("持续维护/运营中", '=COUNTIF(功能明细清单!G:G, "持续维护中")', "配套支持及运营工具"),
        ("整体开发完成率", '=C8/C7', "计算公式: 已完成/总数")
    ]
    
    row_idx = 5
    for label, formula_val, desc in stats:
        ws_dash.cell(row=row_idx, column=2, value=label).font = bold_font
        ws_dash.cell(row=row_idx, column=2).alignment = align_left
        ws_dash.cell(row=row_idx, column=2).border = thin_border
        
        val_cell = ws_dash.cell(row=row_idx, column=3, value=formula_val)
        val_cell.font = bold_font
        val_cell.alignment = align_center
        val_cell.border = thin_border
        
        # Format percentage or numbers
        if label == "整体开发完成率":
            val_cell.number_format = '0.0%'
        else:
            val_cell.number_format = '#,##0'
            
        desc_cell = ws_dash.cell(row=row_idx, column=4, value=desc)
        desc_cell.font = regular_font
        desc_cell.alignment = align_left
        desc_cell.border = thin_border
        
        # Zebra striping for stats card
        if row_idx % 2 == 1:
            ws_dash.cell(row=row_idx, column=2).fill = zebra_fill
            ws_dash.cell(row=row_idx, column=3).fill = zebra_fill
            ws_dash.cell(row=row_idx, column=4).fill = zebra_fill
            
        row_idx += 1
        
    # Add a decorative line or spacer
    ws_dash.column_dimensions["A"].width = 5
    ws_dash.column_dimensions["B"].width = 25
    ws_dash.column_dimensions["C"].width = 18
    ws_dash.column_dimensions["D"].width = 25
    
    # ----------------- SHEET 2: 功能明细清单 (Details) -----------------
    ws_detail = wb.create_sheet(title="功能明细清单")
    ws_detail.views.sheetView[0].showGridLines = True
    
    headers = [
        "序号", "一级功能模块", "二级功能模块", "三级功能点 (叶子功能)", 
        "功能描述", "对应代码/页面/云函数 (技术实现)", "开发状态", "备注/去年合同外"
    ]
    
    for col_idx, h in enumerate(headers, 1):
        cell = ws_detail.cell(row=1, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = align_center
        cell.border = thin_border
        
    detail_rows = [
        # 一、作品征集与投稿系统
        (1, "一、作品征集与投稿系统", "1. 投稿管理", "作品信息填报", "作者在线填写个人基本信息、指导老师信息、陶瓷作品尺寸、工艺及材料等内容", "pages/pottery-submission, createPotterySubmission", "已完成", ""),
        (2, "一、作品征集与投稿系统", "1. 投稿管理", "多媒体图片上传及限制", "支持上传7张白底作品照片（包含整体、四面、顶部、底部、局部细节），大小限制1MB-5MB，JPG格式", "pages/pottery-submission, wx.uploadFile", "已完成", ""),
        (3, "一、作品征集与投稿系统", "1. 投稿管理", "影像作品百度云链接录入", "视频类作品通过百度云盘上传后，在小程序表单中填报百度云分享链接及提取码", "pages/pottery-submission, createPotterySubmission", "已完成", "针对超大视频(3GB)上传的优化"),
        (4, "一、作品征集与投稿系统", "1. 投稿管理", "投稿记录查询", "作者可在个人中心查看已提交的作品状态、审核进度及申报详情", "pages/submission, fetchSubmissionDetail", "已完成", ""),
        (5, "一、作品征集与投稿系统", "1. 投稿管理", "作品修改与撤回", "在报名截止日期前，支持作者撤回并重新修改已填报的作品内容", "pages/submission, updatePotterySubmission, deleteSubmission", "已完成", "去年合同外新增"),
        
        (6, "一、作品征集与投稿系统", "2. 预约与寄送", "送样预约申请", "初审入围作品的作者在线申请线下送样预约，选择寄送或自送方式", "pages/appointment, createAppointment", "已完成", ""),
        (7, "一、作品征集与投稿系统", "2. 预约与寄送", "预约时间与配额限制", "后台动态控制每天送样名额，防止线下收件积压", "pages/reservation, getDeliveryTimeLimit", "已完成", ""),
        (8, "一、作品征集与投稿系统", "2. 预约与寄送", "作品寄送绑定", "录入快递单号、寄送物流公司，便于组委会追踪实物到达情况", "pages/artwork-delivery, createArtworkDelivery", "已完成", ""),
        (9, "一、作品征集与投稿系统", "2. 预约与寄送", "物流状态追踪", "与快递API对接或人工审核入库，实时向作者反馈“已签收/已入库”状态", "pages/artwork-delivery, updateArtworkDelivery", "已完成", ""),
        (10, "一、作品征集与投稿系统", "2. 预约与寄送", "收件凭证生成", "生成包含条形码/二维码的收件电子凭证，现场自送时扫码极速确认", "pages/appointment, fetchSubmissionDetail", "已完成", "去年合同外新增"),
        
        (11, "一、作品征集与投稿系统", "3. 个人中心", "微信授权登录与注册", "使用微信一键授权获取用户基础信息，创建本地账户系统", "pages/profile, login", "已完成", ""),
        (12, "一、作品征集与投稿系统", "3. 个人中心", "作者基本信息维护", "完善和修改个人手机号、学校、身份证号等关键报送身份信息", "pages/user-center, updateSystemConfig", "已完成", ""),
        (13, "一、作品征集与投稿系统", "3. 个人中心", "消息中心与系统通知", "接收系统关于“初审结果发布”、“实物寄送提醒”、“获奖公示”的订阅消息及站内信", "pages/profile, sendMessage", "已完成", "去年合同外新增"),

        # 二、专家在线评审系统
        (14, "二、专家在线评审系统", "1. 评审准入", "专家账号独立安全登录", "后台生成专用专家账号，配合短信/安全校验码进行高强度登录校验", "pages/expert-login, expertLogin, diagnoseExpertLogin", "已完成", ""),
        (15, "二、专家在线评审系统", "1. 评审准入", "廉洁承诺书在线签署", "专家首次登录时，必须强制阅读并在线手写电子签名签署廉洁自律承诺书", "pages/expert-pledge, signPledge, checkPledge", "已完成", "去年合同外核心模块"),
        (16, "二、专家在线评审系统", "1. 评审准入", "评审任务智能领取", "系统自动根据评审批次及分类，将分配的作品包派发给对应专家", "pages/expert-evaluation, fetchSubmissionsForEvaluation", "已完成", ""),
        
        (17, "二、专家在线评审系统", "2. 评分中心", "待评作品分类流转", "支持专家筛选不同类别（传统、当代、数字等）及不同评分状态（未评/已评）的作品", "pages/expert-scoring, fetchSubmissionsForEvaluation", "已完成", ""),
        (18, "二、专家在线评审系统", "2. 评分中心", "陶瓷多媒体在线评审", "专家可缩放查看7张超清作品图，对于数字媒体类作品可在线播放视频文件", "pages/expert-scoring, fetchSubmissionDetail", "已完成", ""),
        (19, "二、专家在线评审系统", "2. 评分中心", "多维度评分细则打分", "根据审美表现、技艺传承、创意等维度输入分值，系统实时自动加权求和", "pages/expert-scoring, submitExpertScore", "已完成", ""),
        (20, "二、专家在线评审系统", "2. 评分中心", "评审学术评语填写", "专家针对每一件打分作品必须填写不少于字数限制的学术性综合评价", "pages/expert-scoring, submitExpertScore", "已完成", ""),
        
        (21, "二、专家在线评审系统", "3. 进度监控", "评分修改与保存", "在评审批次结束提交前，允许专家临时保存草稿并多次修改评分", "pages/expert-scoring, submitExpertScore", "已完成", ""),
        (22, "二、专家在线评审系统", "3. 进度监控", "个人评分进度可视化", "以百分比进度条形式展示专家当前组别的评分进度，避免漏评", "pages/expert-results, getExpertsScoringProgress", "已完成", ""),
        (23, "二、专家在线评审系统", "3. 进度监控", "已评作品回顾", "提供已评作品列表，便于专家对高分/低分作品进行横向对比和二次校准", "pages/expert-results, fetchEvaluationResults", "已完成", "去年合同外新增"),

        # 三、作品展览展示系统
        (24, "三、作品展览展示系统", "1. 作品目录浏览", "海量作品分类检索", "支持按届次、作品类型、学校、作者拼音等多维度进行联合条件检索", "pages/pottery-catalog, fetchCatalogData", "已完成", ""),
        (25, "三、作品展览展示系统", "1. 作品目录浏览", "模糊拼音/关键词搜索", "输入关键字或简拼自动匹配对应的参赛作品与作者", "pages/pottery-query, fetchCatalogData", "已完成", "去年合同外新增"),
        (26, "三、作品展览展示系统", "1. 作品目录浏览", "优秀陶艺作品3D/全景展示", "支持接入第三方全景图或3D模型接口，进行精细化三维虚拟展厅浏览", "pages/pottery-exhibition, fetchPotteryExhibition", "已完成", "去年合同外超合同功能"),
        (27, "三、作品展览展示系统", "1. 作品目录浏览", "数字媒体视频播放", "针对视频、动画、影像类作品，支持流畅的云端CDN视频在线点播与播放", "pages/exhibition, getVideoWorksList", "已完成", ""),
        
        (28, "三、作品展览展示系统", "2. 获奖公示专栏", "电子获奖证书实时生成", "系统根据评审结果，全自动将作者名、作品名等渲染进证书模板生成高清图片提供下载", "pages/award-query, generateRankingResults", "已完成", "去年合同外核心模块"),
        (29, "三、作品展览展示系统", "2. 获奖公示专栏", "获奖名单智能筛查", "按金银铜、优秀奖等不同奖项等级向公众公示，支持作者一键查询", "pages/award-query, fetchEvaluationResults", "已完成", ""),
        (30, "三 " + "、作品展览展示系统", "2. 获奖公示专栏", "优秀作品点赞与互动", "提供观众对优秀参展作品进行收藏、点赞等轻量级互动功能", "pages/artwork-detail, updatePotterySubmission", "已完成", "去年合同外新增"),

        # 四、后台综合管理系统
        (31, "四、后台综合管理系统", "1. 全流程控制", "评审批次与阶段切换", "一键控制系统运行状态：报名中、初审中、复审中、终审中、结果公示中", "pages/admin-panel, updateSystemConfig, getEvaluationPhase", "已完成", ""),
        (32, "四、后台综合管理系统", "1. 全流程控制", "系统核心参数动态修改", "在线设置报名截止日期、快递接收截止日期、评分维度与权重系数", "pages/admin-panel, updateSystemConfig, getEvaluationSettings", "已完成", ""),
        (33, "四、后台综合管理系统", "1. 全流程控制", "初审/终审开关全局控制", "一键冻结或解冻所有考生的报名入口及专家的评分入口", "pages/admin-panel, startFinalEvaluation", "已完成", "去年合同外核心安全机制"),
        
        (34, "四、后台综合管理系统", "2. 专家与用户管理", "专家评委库统一维护", "后台进行专家信息的录入、重置登录密码、关联对应的评审专业大类", "pages/expert-management, fetchExperts, initExpertDatabase", "已完成", ""),
        (35, "四、后台综合管理系统", "2. 专家与用户管理", "专家评分进度大盘监控", "可视化监控所有专家的评分完成率，支持给未完成打分的专家发送短信催评", "pages/admin-panel, getExpertsScoringProgress, checkExpertProgress", "已完成", "去年合同外核心监控模块"),
        (36, "四、后台综合管理系统", "2. 专家与用户管理", "作弊行为智能诊断", "分析专家异常评分数据（如极端分、重复打分、登录IP冲突等）进行安全诊断", "pages/admin-panel, diagnoseExpertLogin", "已完成", "去年合同外核心诊断工具"),
        (37, "四、后台综合管理系统", "2. 专家与用户管理", "特殊评审票交换调仓", "针对需要交叉评审或回避的作品，后台支持将特定专家评分任务进行调换", "cloudfunctions/quickstartFunctions, swapEvaluations, swapEvaluationsByName", "已完成", "去年合同外超强定制业务逻辑"),
        
        (38, "四、后台综合管理系统", "3. 智能数据统计", "初审结果汇总表自动计算", "结合多位专家评分，自动剔除最高分最低分，计算加权均分，生成初审汇总表", "cloudfunctions/quickstartFunctions, generatePreliminaryTable", "已完成", ""),
        (39, "四、后台综合管理系统", "3. 智能数据统计", "终审排名自动生成与解密", "在所有专家完成打分后，一键生成最终排名报表，按得分高低升降序输出", "cloudfunctions/quickstartFunctions, generateFinalRanking", "已完成", ""),
        (40, "四 " + "、后台综合管理系统", "3. 智能数据统计", "EXCEL大批量数据离线导出", "支持将上千条参赛作品及多维评分数据，直接渲染为带格式的Excel文件离线下载", "cloudfunctions/quickstartFunctions, exportCleanedSubmissions, exportFinalResults", "已完成", "极高使用频次的核心运维功能"),
        (41, "四、后台综合管理系统", "3. 智能数据统计", "合格作品一键流转同步", "将初审合格入围的作品数据，一键同步推送到复审/终审作品池中", "cloudfunctions/quickstartFunctions, replaceQualifiedWorks", "已完成", "去年合同外新增"),
        
        (42, "四、后台综合管理系统", "4. 运营与运维工具", "一键安全清空测试数据", "在系统正式上线前，一键安全抹除所有的开发测试垃圾数据", "cloudfunctions/quickstartFunctions, clearTestData, clearAllData, clearCleanTable", "已完成", "去年合同外安全运维保障"),
        (43, "四、后台综合管理系统", "4. 运营与运维工具", "海量测试数据快速生成", "供演示汇报使用，一键在云端自动模拟生成几百条符合业务逻辑的高真实度数据", "cloudfunctions/quickstartFunctions, createTestData, generateTestData", "已完成", "去年合同外用于校级汇报的工具"),
        (44, "四、后台综合管理系统", "4. 运营与运维工具", "历史数据异常格式化修复", "由于老数据导入导致的日期、字符等格式错乱，提供一键全库修复脚本工具", "cloudfunctions/quickstartFunctions, fixDateFormat", "已完成", "去年合同外用于老数据迁移的工具"),
        (45, "四、后台综合管理系统", "4. 运营与运维工具", "图片云链接自动转换工具", "用于解决多媒体资源迁移到正式环境时，图片链接跨环境无法读取的适配问题", "cloudfunctions/quickstartFunctions, convertImageLinks", "已完成", "去年运营保障的核心适配工具"),
        (46, "五、技术运维与敏捷保障", "1. 运行环境维护", "腾讯云开发基础资源运营", "微信小程序云开发环境（云数据库、云存储、云函数、CDN）的长期性能调优与资源消耗规划", "运维保障", "持续维护中", "长期高昂耗能的基础成本"),
        (47, "五、技术运维与敏捷保障", "2. 敏捷需求响应", "业务小改动快速迭代", "针对校方、省厅教育局临时下发的文件，对报名要求、文案等内容在24小时内极速微调上线", "运维保障", "持续维护中", "去年多次顶着时间压力半夜上线"),
        (48, "五、技术运维与敏捷保障", "3. 业务决策介入", "技术可行性与策略指导", "深度参与系统上线后的多次工作组协调会，为组委会从技术角度设计符合实际政策的评审方案", "决策支持", "持续维护中", "超出纯研发范围的业务深绑护航")
    ]
    
    for r in detail_rows:
        ws_detail.append(list(r))
        
    # Styles for details
    for row in range(2, len(detail_rows) + 2):
        # Zebra striping
        fill = zebra_fill if row % 2 == 1 else PatternFill(fill_type=None)
        
        # Determine status cell coloring
        status_val = ws_detail.cell(row=row, column=7).value
        status_fill = None
        if status_val == "已完成":
            status_fill = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid") # soft green
        elif status_val == "持续维护中":
            status_fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid") # soft yellow
            
        for col in range(1, 9):
            cell = ws_detail.cell(row=row, column=col)
            cell.font = regular_font
            cell.border = thin_border
            
            # Alignments
            if col in [1, 7]:
                cell.alignment = align_center
            elif col in [2, 3, 4]:
                cell.alignment = align_left
            else:
                cell.alignment = align_left
                
            # Formatting cell backgrounds
            if col == 7 and status_fill:
                cell.fill = status_fill
                cell.font = bold_font
            elif fill.fill_type:
                cell.fill = fill
                
    # Column auto-fitting with extra safety padding
    col_widths = {
        1: 6,   # ID
        2: 25,  # L1
        3: 20,  # L2
        4: 25,  # L3
        5: 45,  # Desc
        6: 45,  # Implementation
        7: 15,  # Status
        8: 30   # Remarks
    }
    
    for col_idx, w in col_widths.items():
        col_letter = get_column_letter(col_idx)
        ws_detail.column_dimensions[col_letter].width = w
        
    # Freeze Panes on detail sheet
    ws_detail.freeze_panes = "A2"
    
    # Save file
    output_dir = r"C:\Users\Ruan\WeChatProjects\miniprogram-4\outputs\contract-extra-features"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "大陶展系统功能模块清单明细.xlsx")
    
    wb.save(output_path)
    print(f"Excel file created successfully at: {output_path}")
    return output_path

if __name__ == "__main__":
    create_modules_excel()
