
  CREATE OR REPLACE EDITIONABLE PACKAGE "APPS"."FL_RC_UTILITY_PKG" AS

TYPE APPROVE_HEADER_REC_TYPE IS RECORD
(
   ORGANIZATION_ID NUMBER,
   DEPARTMENT_CODE VARCHAR2(10),
   EMP_CLASS_CODE VARCHAR2(10),
   APPROVER_CLASS VARCHAR2(3),
   APPROVE_CATEGORY_TYPE VARCHAR2(30),
   APPROVER_CATEGORY VARCHAR2(20),
   SUBINVENTORY_CODE VARCHAR2(10),
   TRANSFER_ORG_ID NUMBER,
   TRANSFER_SUBINV_CODE VARCHAR2(10),
   PROD_LINE_CODE VARCHAR2(20),
   CALENDAR_CODE VARCHAR2(50),
   SHIFT_NUM NUMBER,
   USER_ID NUMBER,
   ISSUE_REASON_CODE VARCHAR2(100),
   BOM_DEPARTMENT_ID NUMBER,
   RS_SOURCE_TYPE VARCHAR2(20),
   RESPONS_EMP_CLASS VARCHAR2(20),
   RS_LOCATION_ID NUMBER,
   RS_ASSIGN_USER_ID NUMBER,
   RS_TRANSFER_LOCATION_ID NUMBER,
   RS_TRS_ASSIGN_USER_ID NUMBER
);



  function fl_rc_std_resource_flag
  (
   x_organization_id in number,
   x_wip_entity_id in number,
   x_operation_seq in number,
   x_resource_seq  in number,
   x_resource_id   in number
  ) return varchar2 ;
  ----------------------------------------------
  function fl_rc_need_daily_report_flag
  (
   x_rc_line_id      in number,
   x_wip_entity_id in number,
   x_operation_seq in number
  ) return varchar2 ;
  ----------------------------------------------
  --for multi resource
  function fl_rc_need_daily_report_flag2
  (
   x_rc_line_id      in number,
   x_wip_entity_id in number,
   x_operation_seq in number,
   x_bom_resource_id in number
  ) return varchar2 ;
  ----------------------------------------------
  --以工段Department 判斷
  function fl_rc_need_daily_report_flag3
  (
   x_rc_line_id      in number,
   x_wip_entity_id in number,
   x_operation_seq in number
  ) return varchar2 ;
  ----------------------------------------------
  FUNCTION MTL_GET_REQUIRE_APPROVE_FLAG
     (P_APPROVE_LINE_ID IN NUMBER,
      P_issue_header_id IN NUMBER) RETURN VARCHAR2;
  ----------------------------------------------
  FUNCTION MTL_EXP_REQUIRE_APPROVE_FLAG
     (P_APPROVE_LINE_ID IN NUMBER,
      P_issue_header_id IN NUMBER) RETURN VARCHAR2;
  ----------------------------------------------
  --get rc move qty
  function get_rc_move_qty
       (
        p_rc_line_id  number ,       --指示單id
        p_op  number ,       --移轉站別
        p_bom_resource_id number,      --bom resource id
        p_rc_resource_id number,       --rc resource id
        p_qty_type number--1 良品 2 不良品 3 未判品
       ) return number;
  ----------------------------------------------
  --get rc move qty
  function get_rc_move_qty2
       (
        p_rc_line_id  number ,       --指示單id
        p_op  number ,       --移轉站別
        p_bom_resource_id number,      --bom resource id
        p_rc_resource_id number,       --rc resource id
        p_actual_prod_date in date,    --實際產出日期
        p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
        P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
        p_qty_type number--1 良品 2 不良品 3 未判品
       ) return number;
  ----------------------------------------------
  --get rc move qty
  function get_rc_move_qty_no_rework_rt
       (
        p_rc_line_id  number ,       --指示單id
        p_op  number ,       --移轉站別
        p_bom_resource_id number,      --bom resource id
        p_rc_resource_id number,       --rc resource id
        p_actual_prod_date in date,    --實際產出日期
        p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
        P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
        p_qty_type number--1 良品 2 不良品 3 未判品
       ) return number;
  ----------------------------------------------
  --get flow card move qty
  function get_flow_card_move_qty
       (
        p_rc_line_id  number ,       --指示單id
        p_flow_card_id number,       --flow card id
        p_op  number ,               --移轉站別
        p_bom_resource_id number,      --bom resource id
        p_rc_resource_id number,       --rc resource id
        p_actual_prod_date in date,    --實際產出日期
        p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
        P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
        p_segment_code in number,      --節數
        p_qty_type number--1 良品 2 不良品 3 未判品
       ) return number;
  ----------------------------------------------
  --get flow card move qty
  function get_flow_card_accu_move_qty
       (
        p_rc_line_id  number ,       --指示單id
        p_flow_card_id number,       --flow card id
        p_op  number ,               --移轉站別
        p_bom_resource_id number,      --bom resource id
        p_rc_resource_id number,       --rc resource id
        p_actual_prod_date in date,    --實際產出日期
        p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
        P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
        p_segment_code in number,      --節數
        p_qty_type number--1 良品 2 不良品 3 未判品
       ) return number;
  ----------------------------------------------
  procedure get_flow_card_allow_move_qty
         (
          p_rc_line_id  number ,       --指示單id
          p_flow_card_id number,       --flow card id
          p_op  number ,               --移轉站別
          p_return_flag varchar2,
          p_bom_resource_id number,      --bom resource id
          p_rc_resource_id number,       --rc resource id
          p_actual_prod_date in date,    --實際產出日期
          p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
          P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
          p_segment_code in number,      --節數
          p_allow_good_move_qty out number, --指示單良品可移轉數
          p_allow_ng_move_qty out number,    --指示單不良品可移轉數
          p_allow_rj_move_qty out number    --指示單未判品可移轉數
         ) ;
  ----------------------------------------------
  function get_flow_card_allow_move_flag
         (
          p_rc_line_id  number ,       --指示單id
          p_flow_card_id number,       --flow card id
          p_op  number ,               --移轉站別
          p_return_flag varchar2,
          p_bom_resource_id number,      --bom resource id
          p_rc_resource_id number,       --rc resource id
          p_actual_prod_date in date,    --實際產出日期
          p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
          P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
          p_segment_code in number      --節數
         ) return varchar2 ;
  ----------------------------------------------------
  --get rc resource qty
  function get_rc_resource_qty
       (
        p_rc_line_id  number ,       --指示單id
        p_op  number ,       --移轉站別
        p_bom_resource_id number,      --bom resource id
        p_rc_resource_id number,       --rc resource id
        p_qty_type number--1 生產指示系統數量 2 生產指示系統確定進Oracle數量
       ) return number;
  ----------------------------------------------
  --get rc resource qty
  function get_rc_resource_qty2
       (
        p_rc_line_id  number ,       --指示單id
        p_op  number ,       --移轉站別
        p_bom_resource_id number,      --bom resource id
        p_rc_resource_id number,       --rc resource id
        p_actual_prod_date in date,    --實際產出日期
        p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
        P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
        p_qty_type number--1 生產指示系統數量 2 生產指示系統確定進Oracle數量
       ) return number;
  --get rc no
  function get_rc_no
       (
        p_rc_line_id  number       --指示單id
       ) return varchar2;

  FUNCTION CHECK_APPROVE_RULE
           (
           p_rule_id in number,
           p_approver_class in varchar2,
           p_approve_category_type in varchar2,
           p_approver_category in varchar2,
           p_subinventory_code in varchar2,
           p_transfer_org_id in number,
           p_transfer_subinv_code in varchar2,
           p_user_id in number,
           p_issue_reason_code in varchar2,
           p_rs_source_type in varchar2,
           p_respons_emp_class in varchar2,
           p_rs_location_id in number,
           p_rs_assign_user_id in number,
           p_rs_transfer_location_id in number,
           p_rs_trs_assign_user_id in number
           ) RETURN VARCHAR2;

  FUNCTION GET_APPROVE_HEADER_ID
           (
           p_organization_id in number,
           p_department_code in varchar2,
           p_emp_class_code in varchar2,
           p_approver_class in varchar2,
           p_approve_category_type in varchar2,
           p_approver_category in varchar2,
           p_subinventory_code in varchar2,
           p_transfer_org_id in number,
           p_transfer_subinv_code in varchar2,
           p_prod_line_code in varchar2,
           p_calendar_code in varchar2,
           p_shift_num in number,
           p_user_id in number,
           P_ISSUE_REASON_CODE in varchar2,
           p_bom_department_id in number
           ) RETURN NUMBER;
  ----------------------------------------------

    FUNCTION GET_APPROVE_HEADER_ID2
             (
             p_par_rec in FL_RC_UTILITY_PKG.APPROVE_HEADER_REC_TYPE
             ) RETURN NUMBER;
  ------------------------------------------------
  --get good mtl return qty
  function get_good_mtl_return_qty
       (
        p_wip_entity_id in number,   --wip job id
        p_inventory_item_id in number,
        p_op_seq in number,
        p_organization_id in  number,
        p_get_type in number --1 get所有數量 2 get 已扣帳數
       ) return number;
  ----------------------------------------------
  function get_lookup_meaning
       (
        p_organization_id in number,
        p_lookup_type in varchar2,
        p_code in varchar2
       ) return varchar2;
  ----------------------------------------------
  function get_default_category_set_name
       (
        p_organization_id in number
       ) return varchar2;
  ----------------------------------------------
  function job_close_flag
       (
        p_wip_entity_id in number
       ) return varchar2;
  ----------------------------------------------
  function job_close_status
       (
        p_wip_entity_id in number
       ) return number;
  ----------------------------------------------
  function get_countersign_str
       (
        p_approve_class IN VARCHAR2,
        p_approve_category_type IN VARCHAR2,
        p_approve_category_code IN VARCHAR2,
        p_DOC_HEADER_ID  IN NUMBER,
        p_DOC_LINE_ID IN NUMBER,
        p_DOC_LINE_CODE IN VARCHAR2
        ) return VARCHAR2;
  ----------------------------------------------
  --檢核簽核歷史資料主簽核流程是否重複
  function check_approval_duplicate
       (
        p_approve_class IN VARCHAR2,
        p_doc_header_id IN NUMBER,
        p_doc_line_id   IN NUMBER,
        p_doc_line_code IN VARCHAR2
        ) return VARCHAR2;
  ----------------------------------------------
  FUNCTION FL_GET_RC_APPLY_QTY(P_ORGANIZATION_ID NUMBER,
                               P_RC_RESOURCE_ID  NUMBER,
                               P_LOCATION_ID     NUMBER,
                               P_ASSIGN_USER_ID  NUMBER,
                               P_LOT_NUMBER VARCHAR2) RETURN NUMBER;
  ----------------------------------------------
  FUNCTION VALUE_TYPE_STRING(P_source_value IN VARCHAR2,
                               P_data_type    IN VARCHAR2) RETURN VARCHAR2;
  ----------------------------------------------
  FUNCTION FL_GET_RS_ONHAND_QTY(P_ORGANIZATION_ID NUMBER,
                               P_RC_RESOURCE_ID  NUMBER,
                               P_LOCATION_ID     NUMBER,
                               P_ASSIGN_USER_ID  NUMBER,
                               P_LOT_NUMBER VARCHAR2) RETURN NUMBER;

END FL_RC_UTILITY_PKG ;


CREATE OR REPLACE EDITIONABLE PACKAGE BODY "APPS"."FL_RC_UTILITY_PKG" AS

  function fl_rc_std_resource_flag
    (
     x_organization_id in number,
     x_wip_entity_id in number,
     x_operation_seq in number,
     x_resource_seq  in number,
     x_resource_id   in number
    ) return varchar2 is
   p_organization_id number := x_organization_id;
   p_wip_entity_id number := x_wip_entity_id;
   p_operation_seq number := x_operation_seq;
   p_resource_seq number :=  x_resource_seq;
   p_resource_id number  :=  x_resource_id;
   P_MANUAL_ASSIGN_MOVE_RESOURCE varchar2(10);

   --p_resource_count number := 0;
   p_charged_resource_flag varchar2(1) := 'N';

  begin
        --原先標準公單是判斷在工單的Resource若其Scheduled Flag為YES, 則做製程移轉工時Charge, 有些Org則以BOM Resource基本設定的DFF做註明
        BEGIN
            SELECT NOTE1
           INTO P_MANUAL_ASSIGN_MOVE_RESOURCE
           FROM FL_LOOKUP_VALUES FLV
           WHERE FLV.LOOKUP_TYPE  = 'RUN_CARD_PARAMETER'
                 AND LOOKUP_CODE = 'MANUAL_ASSIGN_MOVE_RESOURCE'
                 AND FL_RC_PKG.LOOKUP_CODE_ACCESS(p_organization_id,FLV.LOOKUP_TYPE,FLV.LOOKUP_CODE,FLV.CONTROL_LEVEL,FLV.CONTROL_LEVEL_ID) = 'Y';

        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        IF P_MANUAL_ASSIGN_MOVE_RESOURCE = 'Y' THEN
           --判斷Resource DFF
             BEGIN
                 select decode(br.attribute2,'Y','Y','N')
                 into p_charged_resource_flag
                 from BOM_RESOURCES br
                   where br.resource_id = p_resource_id;
             EXCEPTION
                      WHEN OTHERS THEN NULL;
             END;

        ELSE --判斷工單Resource Schedule Flag
             BEGIN
                 select decode(wor.scheduled_flag,1,'Y','N')
                 into p_charged_resource_flag
                 from  wip_operation_resources wor
                 where  wor.wip_entity_id = p_wip_entity_id
                      and wor.resource_id = p_resource_id
                      and wor.operation_seq_num = p_operation_seq
                      and wor.resource_seq_num = p_resource_seq
                      --and wor.scheduled_flag = 1
                      ;
             EXCEPTION
                      WHEN OTHERS THEN NULL;
             END;
        END IF;

        return(p_charged_resource_flag );

  end fl_rc_std_resource_flag;
  -----------------------------------------------------------------------
  function fl_rc_need_daily_report_flag
    (
     x_rc_line_id      in number,
     x_wip_entity_id in number,
     x_operation_seq in number
    ) return varchar2 is
   --p_organization_id number := x_organization_id;
   p_rc_line_id    number := x_rc_line_id;
   p_wip_entity_id number := x_wip_entity_id;
   p_operation_seq number := x_operation_seq;

   p_std_resource_id number;
   P_JOB_TYPE  number;
   p_op_temp number;
   --p_resource_count number := 0;
   p_need_daily_report_flag varchar2(1) := 'N';
  begin

   if p_rc_line_id is not null then
      --判斷工單類別
      BEGIN
           SELECT JOB_TYPE,job.wip_entity_id
           INTO P_JOB_TYPE,p_wip_entity_id --1 standard job 3 non standard job
           FROM WIP_DISCRETE_JOBS JOB,
                FL_RC_LINES_ALL RL
           WHERE JOB.WIP_ENTITY_ID = RL.WIP_ENTITY_ID
               AND RL.RC_LINE_ID = p_rc_line_id;
      EXCEPTION WHEN OTHERS THEN p_need_daily_report_flag := 'E';
      END;
   elsif p_wip_entity_id is not null then
      --判斷工單類別
      BEGIN
           SELECT JOB_TYPE
           INTO P_JOB_TYPE --1 standard job 3 non standard job
           FROM WIP_DISCRETE_JOBS JOB
           WHERE JOB.WIP_ENTITY_ID = p_wip_entity_id;
      EXCEPTION WHEN OTHERS THEN p_need_daily_report_flag := 'E';
      END;
   end if;

   --判斷op number存不存在
   if p_need_daily_report_flag <> 'E' then
         begin
          select wo.operation_seq_num
          into p_op_temp
          from
             WIP_OPERATIONS wo
          where 1=1
              and wo.operation_seq_num = p_operation_seq
              and wo.wip_entity_id = p_wip_entity_id;
         exception when others then  p_need_daily_report_flag := 'E';
         end ;
   end if;

   if p_need_daily_report_flag <> 'E' then
    if p_operation_seq < 900 then
      if P_JOB_TYPE = 1 then --標準工單
         --判斷resource id
         begin
          select wor.resource_id
          into p_std_resource_id
          from
             wip_operation_resources wor
          where 1=1
              and wor.operation_seq_num = p_operation_seq
              and fl_rc_std_resource_flag
                  (
                  wor.organization_id,
                  wor.wip_entity_id  ,
                  wor.operation_seq_num  ,
                  wor.resource_seq_num ,
                  wor.resource_id
                  ) = 'Y'
              and wor.wip_entity_id = p_wip_entity_id;
         exception when others then  p_need_daily_report_flag := 'E';
         end ;
           --判斷Resource DFF
         if  p_need_daily_report_flag <> 'E' then
             BEGIN
                 select decode(br.attribute3,'N','N','Y')
                 into p_need_daily_report_flag
                 from BOM_RESOURCES br
                   where br.resource_id = p_std_resource_id;
             EXCEPTION
                      WHEN OTHERS THEN p_need_daily_report_flag := 'E';
             END;
          end if;
      else --非標準工單
         p_need_daily_report_flag := 'Y';
      end if;
     else --operation >= 900
       p_need_daily_report_flag := 'N';
     end if;
   else
     p_need_daily_report_flag := 'E';
   end if; --p_need_daily_report_flag is null
     return(p_need_daily_report_flag);

  end fl_rc_need_daily_report_flag;
  -----------------------------------------------------------------------
  function fl_rc_need_daily_report_flag2
    (
     x_rc_line_id      in number,
     x_wip_entity_id in number,
     x_operation_seq in number,
     x_bom_resource_id in number
    ) return varchar2 is
   --p_organization_id number := x_organization_id;
   p_rc_line_id    number := x_rc_line_id;
   p_wip_entity_id number := x_wip_entity_id;
   p_operation_seq number := x_operation_seq;

   p_std_resource_id number;
   P_JOB_TYPE  number;
   p_op_temp number;
   --p_resource_count number := 0;
   p_need_daily_report_flag varchar2(1) := 'N';
  begin

   if p_rc_line_id is not null then
      --判斷工單類別
      BEGIN
           SELECT JOB_TYPE,job.wip_entity_id
           INTO P_JOB_TYPE,p_wip_entity_id --1 standard job 3 non standard job
           FROM WIP_DISCRETE_JOBS JOB,
                FL_RC_LINES_ALL RL
           WHERE JOB.WIP_ENTITY_ID = RL.WIP_ENTITY_ID
               AND RL.RC_LINE_ID = p_rc_line_id;
      EXCEPTION WHEN OTHERS THEN p_need_daily_report_flag := 'E';
      END;
   elsif p_wip_entity_id is not null then
      --判斷工單類別
      BEGIN
           SELECT JOB_TYPE
           INTO P_JOB_TYPE --1 standard job 3 non standard job
           FROM WIP_DISCRETE_JOBS JOB
           WHERE JOB.WIP_ENTITY_ID = p_wip_entity_id;
      EXCEPTION WHEN OTHERS THEN p_need_daily_report_flag := 'E';
      END;
   end if;

   --判斷op number存不存在
   if p_need_daily_report_flag <> 'E' then
         begin
          select wo.operation_seq_num
          into p_op_temp
          from
             WIP_OPERATIONS wo
          where 1=1
              and wo.operation_seq_num = p_operation_seq
              and wo.wip_entity_id = p_wip_entity_id;
         exception when others then  p_need_daily_report_flag := 'E';
         end ;
   end if;

   if p_need_daily_report_flag <> 'E' then
    if p_operation_seq < 900 then
      if P_JOB_TYPE = 1 then --標準工單
           --判斷Resource DFF
             BEGIN
                 select decode(br.attribute3,'N','N','Y')
                 into p_need_daily_report_flag
                 from BOM_RESOURCES br
                   where br.resource_id = x_bom_resource_id;
             EXCEPTION
                      WHEN OTHERS THEN p_need_daily_report_flag := 'E';
             END;
      else --非標準工單
         p_need_daily_report_flag := 'Y';
      end if;
     else --operation >= 900
       p_need_daily_report_flag := 'N';
     end if;
   else
     p_need_daily_report_flag := 'E';
   end if; --p_need_daily_report_flag is null
     return(p_need_daily_report_flag);

  end fl_rc_need_daily_report_flag2;

  -----------------------------------------------------------------------
  --以工段Department 判斷
  function fl_rc_need_daily_report_flag3
    (
     x_rc_line_id      in number,
     x_wip_entity_id in number,
     x_operation_seq in number
    ) return varchar2 is
   --p_organization_id number := x_organization_id;
   p_rc_line_id    number := x_rc_line_id;
   p_wip_entity_id number := x_wip_entity_id;
   p_operation_seq number := x_operation_seq;

   p_std_resource_id number;
   P_JOB_TYPE  number;
   p_op_temp number;
   --p_resource_count number := 0;
   p_need_daily_report_flag varchar2(1) := 'N';
  begin

   if p_rc_line_id is not null then
      --判斷工單類別
      BEGIN
           SELECT JOB_TYPE,job.wip_entity_id
           INTO P_JOB_TYPE,p_wip_entity_id --1 standard job 3 non standard job
           FROM WIP_DISCRETE_JOBS JOB,
                FL_RC_LINES_ALL RL
           WHERE JOB.WIP_ENTITY_ID = RL.WIP_ENTITY_ID
               AND RL.RC_LINE_ID = p_rc_line_id;
      EXCEPTION WHEN OTHERS THEN p_need_daily_report_flag := 'E';
      END;
   elsif p_wip_entity_id is not null then
      --判斷工單類別
      BEGIN
           SELECT JOB_TYPE
           INTO P_JOB_TYPE --1 standard job 3 non standard job
           FROM WIP_DISCRETE_JOBS JOB
           WHERE JOB.WIP_ENTITY_ID = p_wip_entity_id;
      EXCEPTION WHEN OTHERS THEN p_need_daily_report_flag := 'E';
      END;
   end if;

   --判斷op number存不存在
   if p_need_daily_report_flag <> 'E' then
         begin
          select wo.operation_seq_num
          into p_op_temp
          from
             WIP_OPERATIONS wo
          where 1=1
              and wo.operation_seq_num = p_operation_seq
              and wo.wip_entity_id = p_wip_entity_id;
         exception when others then  p_need_daily_report_flag := 'E';
         end ;
   end if;

   if p_need_daily_report_flag <> 'E' then
    if p_operation_seq < 900 then
      if P_JOB_TYPE = 1 then --標準工單
         --判斷department
         begin
          select decode(bd.attribute1,'Y','N','Y')
          into p_need_daily_report_flag
          from
             wip_operations wor,
             BOM_DEPARTMENTS bd
          where 1=1
              and wor.operation_seq_num = p_operation_seq
              and wor.department_id = bd.department_id
              and wor.wip_entity_id = p_wip_entity_id;
         exception when others then  p_need_daily_report_flag := 'E';
         end ;
      else --非標準工單
         p_need_daily_report_flag := 'Y';
      end if;
     else --operation >= 900
       p_need_daily_report_flag := 'N';
     end if;
   else
     p_need_daily_report_flag := 'E';
   end if; --p_need_daily_report_flag is null
     return(p_need_daily_report_flag);

  end fl_rc_need_daily_report_flag3;
  ------------------------------------------------
    FUNCTION MTL_GET_REQUIRE_APPROVE_FLAG
       (P_APPROVE_LINE_ID IN NUMBER,
        P_issue_header_id IN NUMBER) RETURN VARCHAR2 IS

        --P_APPROVE_LINE_ID  NUMBER := 5424;
        x_issue_header_id  number := P_issue_header_id;


        x_issue_type VARCHAR2(10);
        x_wip_entity_id number;

        P_ISSUE_QTY2_PERCENT NUMBER;
        P_ISSUE_QTY3_PERCENT NUMBER;
        P_ISSUE_QTY5_PERCENT NUMBER;
        P_ISSUE_QTY6_PERCENT NUMBER;
        P_required_quantity NUMBER;
        X_REQUIRE_APPROVE_FLAG VARCHAR2(10) := 'N';
        x_count number;
        p_sum_total_amount NUMBER;
        x_dpt_emp_class varchar2(10);


        CURSOR C0 IS
        SELECT *
        FROM fl_rc_approver_lines_all APL
        WHERE APL.APPROVE_LINE_ID = P_APPROVE_LINE_ID;

        CURSOR C1 IS
        select
          wdj.WIP_ENTITY_ID,
          INVENTORY_ITEM_ID,
          OPERATION_SEQ_NUM,
          IH.ORGANIZATION_ID,
          ISSUE_APPLY_QTY2,
          ISSUE_QTY2,
          ISSUE_APPLY_QTY3,
          ISSUE_QTY3,
          ISSUE_APPLY_QTY5,
          ISSUE_QTY5,
          ISSUE_APPLY_QTY6,
          ISSUE_QTY6,
          IL.required_quantity,
          wdj.start_quantity
        from FL_WIP_MTL_ISSUE_LINESS_V  IL,

             FL_WIP_MTL_ISSUE_HEADERS_ALL IH,
             wip_discrete_jobs wdj
        WHERE IL.ISSUE_HEADER_ID = IH.ISSUE_HEADER_ID
             AND IH.ISSUE_HEADER_ID = x_issue_header_id
             and wdj.wip_entity_id = ih.wip_entity_id
             and wdj.organization_id = ih.organization_id
             ;

    begin

    --FND_MESSAGE.DEBUG('GET FLAG START ');
     FOR REC0 IN C0 LOOP
           begin
             SELECT ihs.wip_entity_id,ihs.issue_type
             into x_wip_entity_id,x_issue_type
             FROM Fl_Wip_Mtl_Issue_Headers_All  ihs
             where ihs.issue_header_id = x_issue_header_id;

          exception when others then null;
          end;


          IF REC0.ATTRIBUTE1 IS NULL AND   --補料百分比
              REC0.ATTRIBUTE2 IS NULL AND   --退料百分比
              REC0.ATTRIBUTE3 IS NULL AND   --補料金額
              REC0.ATTRIBUTE4 IS NULL THEN  --退料金額
             --沒有設定,一定要經過審核
               X_REQUIRE_APPROVE_FLAG := 'Y';
          elsif x_ISSUE_TYPE IN ('2','6') --生產性及非生產性補料
               AND  REC0.ATTRIBUTE1 IS NULL AND   --補料百分比
                 REC0.ATTRIBUTE3 IS NULL  then   --捕料金額
                X_REQUIRE_APPROVE_FLAG := 'Y';
          elsif x_ISSUE_TYPE IN ('3','7') --生產性及非生產性退料
                AND  REC0.ATTRIBUTE2 IS NULL AND   --退料百分比
                 REC0.ATTRIBUTE4 IS NULL  then   --退料金額
                X_REQUIRE_APPROVE_FLAG := 'Y';

          else
            --判斷申請總金額

            p_sum_total_amount := 0;
            begin
               select SUM(round(nvl(CST.ITEM_COST,0)*
               abs(nvl(decode(ih.flow_status,'6',il.deduct_qty,il.apply_qty),0)),2)) item_cost_amount
               into p_sum_total_amount
               from
                Fl_Wip_Mtl_Issue_Headers_All  ih,
                Fl_Wip_Mtl_Issue_Liness_All  il,
                CST_ITEM_COSTS CST
               where 1=1
                and ih.issue_header_id = il.issue_header_id
                and il.inventory_item_id = cst.inventory_item_id
                and il.organization_id = cst.organization_id
                and CST.COST_TYPE_ID = 1
                and ih.WIP_ENTITY_ID = x_wip_entity_id
                and ih.issue_type =   x_ISSUE_TYPE
                and ih.flow_status not in ('4','5','7'); /*審核退回 扣帳退回 作廢*/
             exception when others then null;
             end;
           --補料金額CHECK
           IF X_ISSUE_TYPE IN ('2','6') THEN --生產性及非生產性補料
               IF REC0.ATTRIBUTE3 IS NOT NULL THEN --補料金額有設定
                     IF NVL(p_sum_total_amount,0) >=
                         TO_NUMBER(REC0.ATTRIBUTE3) THEN
                         X_REQUIRE_APPROVE_FLAG := 'Y';
                     END IF;
                END IF;
           END IF;
           --退料金額CHECK
           IF X_ISSUE_TYPE IN ('3','7') THEN --生產性及非生產性退料
               IF REC0.ATTRIBUTE4 IS NOT NULL THEN --退料金額有設定
                     IF NVL(p_sum_total_amount,0) >=
                         TO_NUMBER(REC0.ATTRIBUTE4) THEN
                         X_REQUIRE_APPROVE_FLAG := 'Y';
                     END IF;
                END IF;
           END IF;
           if (X_REQUIRE_APPROVE_FLAG is null or X_REQUIRE_APPROVE_FLAG = 'N') and (REC0.ATTRIBUTE1 is not null or REC0.ATTRIBUTE2 is not null)  then
            FOR REC1 IN C1 LOOP
                P_required_quantity := NULL;
                P_ISSUE_QTY2_PERCENT := null;
                P_ISSUE_QTY3_PERCENT := null;
                P_ISSUE_QTY5_PERCENT := null;
                P_ISSUE_QTY6_PERCENT := null;
                BEGIN
                     SELECT   WRO.required_quantity
                     INTO P_required_quantity
                     FROM WIP_REQUIREMENT_OPERATIONS WRO
                     WHERE REC1.WIP_ENTITY_ID = WRO.wip_entity_id
                        AND REC1.INVENTORY_ITEM_ID = WRO.inventory_item_id
                        AND REC1.OPERATION_SEQ_NUM = WRO.operation_seq_num
                        AND REC1.ORGANIZATION_ID = WRO.ORGANIZATION_ID;
                EXCEPTION WHEN OTHERS THEN NULL;
                END;

                IF REC1.OPERATION_SEQ_NUM = -10 OR P_required_quantity = 0 then
                    P_ISSUE_QTY2_PERCENT := abs(round(nvl(rec1.ISSUE_APPLY_QTY2,0)*100/REC1.start_quantity,2));
                    P_ISSUE_QTY3_PERCENT := abs(round(nvl(rec1.ISSUE_APPLY_QTY3,0)*100/REC1.start_quantity,2));
                    P_ISSUE_QTY5_PERCENT := abs(round(nvl(rec1.ISSUE_APPLY_QTY5,0)*100/REC1.start_quantity,2));
                    P_ISSUE_QTY6_PERCENT := abs(round(nvl(rec1.ISSUE_APPLY_QTY6,0)*100/REC1.start_quantity,2));
                else
                    P_ISSUE_QTY2_PERCENT := abs(round(nvl(REC1.ISSUE_APPLY_QTY2,0)*100/REC1.REQUIRED_QUANTITY,2));
                    P_ISSUE_QTY3_PERCENT := abs(round(nvl(REC1.ISSUE_APPLY_QTY3,0)*100/REC1.REQUIRED_QUANTITY,2));
                    P_ISSUE_QTY5_PERCENT := abs(round(nvl(REC1.ISSUE_APPLY_QTY5,0)*100/REC1.REQUIRED_QUANTITY,2));
                    P_ISSUE_QTY6_PERCENT := abs(round(nvl(REC1.ISSUE_APPLY_QTY6,0)*100/REC1.REQUIRED_QUANTITY,2));
                end if;


                IF X_ISSUE_TYPE IN ('2','6') THEN --生產性及非生產性補料
                   IF REC0.ATTRIBUTE1 IS NOT NULL THEN
                      IF X_ISSUE_TYPE = '2' THEN
                          IF P_ISSUE_QTY2_PERCENT   >= TO_NUMBER(REC0.ATTRIBUTE1) THEN
                               X_REQUIRE_APPROVE_FLAG := 'Y';
                          END IF;
                      ELSE
                          IF P_ISSUE_QTY5_PERCENT   >= TO_NUMBER(REC0.ATTRIBUTE1) THEN
                               X_REQUIRE_APPROVE_FLAG := 'Y';
                          END IF;
                      END IF;
                   ELSE
                      X_REQUIRE_APPROVE_FLAG := 'Y';
                   END IF;
                ELSIF X_ISSUE_TYPE IN ('3','7') THEN --生產性及非生產性退料
                   IF REC0.ATTRIBUTE2 IS NOT NULL THEN
                       IF X_ISSUE_TYPE = '3' THEN
                           IF P_ISSUE_QTY3_PERCENT   >= TO_NUMBER(REC0.ATTRIBUTE2) THEN
                                 X_REQUIRE_APPROVE_FLAG := 'Y';
                            END IF;
                       ELSE
                           IF P_ISSUE_QTY6_PERCENT   >= TO_NUMBER(REC0.ATTRIBUTE2) THEN
                                 X_REQUIRE_APPROVE_FLAG := 'Y';
                            END IF;
                       END IF;
                   ELSE
                       X_REQUIRE_APPROVE_FLAG := 'Y';

                   END IF;

                END IF;

            END LOOP;--REC1
           end if;--X_REQUIRE_APPROVE_FLAG is null
        end if; --REC1.ATTRIBUTE1~4


         --判斷責任部門
         IF REC0.ATTRIBUTE5 IS NOT NULL THEN


            --判斷是否本部門,是的話不需簽核
            x_dpt_emp_class := null;
            begin
                  select lv.attribute2
                  into x_dpt_emp_class
                  from fl_rc_approver_headers_all aph,
                       fl_rc_approver_lines_all apl,
                       fl_lookup_values lv
                  where apl.approve_line_id = P_APPROVE_LINE_ID
                      and aph.approve_header_id = apl.approve_header_id
                      and lv.lookup_type = 'RC PRODUCT LINE'
                      and lv.control_level_id = apl.organization_id
                      and lv.lookup_code = aph.department_code
                      ;
            exception when others then null;
            end;

            if x_dpt_emp_class is not null then


                if instr(REC0.ATTRIBUTE5,x_dpt_emp_class) <> 0 then
                    X_REQUIRE_APPROVE_FLAG := 'N';
                else
                      x_count := 0;

                      --判斷是否責任部門存在於APP LINE設定
                      select count(1)
                      into x_count
                      from FL_WIP_MTL_NG_ALL mn
                      where mn.issue_header_id = x_issue_header_id
                        and REC0.ATTRIBUTE5 like '%'||NVL(mn.department_code,'X')||'%'
                        ;

                      if x_count = 0 then
                         X_REQUIRE_APPROVE_FLAG := 'N';
                      end if;

                end if;
            end if;


         END IF;

    END LOOP; --REC0

    --DBMS_OUTPUT.put_line('x_require_approve_flag='||x_require_approve_flag);
    RETURN(x_require_approve_flag);

    end MTL_GET_REQUIRE_APPROVE_FLAG;
  ------------------------------------------------
    FUNCTION MTL_EXP_REQUIRE_APPROVE_FLAG
       (P_APPROVE_LINE_ID IN NUMBER,
        P_issue_header_id IN NUMBER) RETURN VARCHAR2 IS

        --P_APPROVE_LINE_ID  NUMBER := 5424;
        x_issue_header_id  number := P_issue_header_id;


        x_issue_type VARCHAR2(10);

        P_required_quantity NUMBER;
        X_REQUIRE_APPROVE_FLAG VARCHAR2(10) := 'N';
        p_sum_total_amount NUMBER;

        CURSOR C0 IS
        SELECT *
        FROM fl_rc_approver_lines_all APL
        WHERE APL.APPROVE_LINE_ID = P_APPROVE_LINE_ID;
    begin

    --FND_MESSAGE.DEBUG('GET FLAG START ');
     FOR REC0 IN C0 LOOP

          IF REC0.ATTRIBUTE5 IS NULL THEN  --部門領退類別金額
            --沒有設定,一定要經過審核
            X_REQUIRE_APPROVE_FLAG := 'Y';
          else
            --判斷申請總金額

            p_sum_total_amount := 0;
            begin
               select SUM(round(nvl(CST.ITEM_COST,0)*
               abs(nvl(decode(ih.flow_status,'6',il.deduct_qty,il.apply_qty),0)),2)) item_cost_amount
               into p_sum_total_amount
               from
                Fl_Wip_Mtl_Issue_Headers_All  ih,
                Fl_Wip_Mtl_Issue_Liness_All  il,
                CST_ITEM_COSTS CST
               where 1=1
                and ih.issue_header_id = il.issue_header_id
                and il.inventory_item_id = cst.inventory_item_id
                and il.organization_id = cst.organization_id
                and CST.COST_TYPE_ID = 1
                and ih.issue_header_id = P_issue_header_id
                and ih.flow_status not in ('4','5','7'); /*審核退回 扣帳退回 作廢*/
             exception when others then null;
             end;

               IF NVL(p_sum_total_amount,0) >=
                    TO_NUMBER(REC0.ATTRIBUTE5 ) THEN
                   X_REQUIRE_APPROVE_FLAG := 'Y';
               END IF;

         end if; --REC0.ATTRIBUTE5

    END LOOP; --REC0

    --DBMS_OUTPUT.put_line('x_require_approve_flag='||x_require_approve_flag);
    RETURN(x_require_approve_flag);

    end MTL_EXP_REQUIRE_APPROVE_FLAG;
    ----------------------------------------------
    --get rc move qty
    function get_rc_move_qty
         (
          p_rc_line_id  number ,       --指示單id
          p_op  number ,       --移轉站別
          p_bom_resource_id number,      --bom resource id
          p_rc_resource_id number,       --rc resource id
          p_qty_type number--1 良品 2 不良品 3 未判品
         ) return number is
      p_rc_good_move_qty  number; --指示單良品總移轉數
      p_rc_ng_move_qty  number;    --指示單不良品總移轉數
      p_rc_rj_move_qty  number;    --指示單未判品總移轉數
      p_rc_good_packing_qty  number; --指示單良品包裝總移轉數
      p_rc_good_carton_qty  number; --指示單良品(包;箱;捲)總移轉數


      p_move_to_op NUMBER;
      P_qty number;

     begin
         p_move_to_op := FL_RC_PKG.GET_NEXT_OP(p_rc_line_id,p_op,'N');

         FL_RC_PKG.RC_MOVE_QTY2
          (
         p_rc_line_id ,       --指示單id
         p_move_to_op ,       --移轉站別
         p_bom_resource_id ,      --bom resource id
         p_rc_resource_id ,       --rc resource id
         p_rc_good_move_qty , --指示單良品總移轉數
         p_rc_ng_move_qty ,    --指示單不良品總移轉數
         p_rc_rj_move_qty ,    --指示單未判品總移轉數
         p_rc_good_packing_qty , --指示單良品包裝總移轉數
         p_rc_good_carton_qty  --指示單良品(包,箱,捲)總移轉數
          );

         IF p_qty_type =  1 THEN
            P_qty := p_rc_good_move_qty;
         ELSIF p_qty_type =  2 THEN
            P_qty := p_rc_ng_move_qty;
         ELSIF p_qty_type =  3 THEN
            P_qty := p_rc_rj_move_qty;
         ELSE
            P_qty := 0;
         END IF;

         RETURN(P_qty);
     end get_rc_move_qty;
    ----------------------------------------------
    --get rc move qty
    function get_rc_move_qty2
         (
          p_rc_line_id  number ,       --指示單id
          p_op  number ,       --移轉站別
          p_bom_resource_id number,      --bom resource id
          p_rc_resource_id number,       --rc resource id
          p_actual_prod_date in date,    --實際產出日期
          p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
          P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
          p_qty_type number--1 良品 2 不良品 3 未判品
         ) return number is
      p_rc_good_move_qty  number; --指示單良品總移轉數
      p_rc_ng_move_qty  number;    --指示單不良品總移轉數
      p_rc_rj_move_qty  number;    --指示單未判品總移轉數
      p_rc_good_packing_qty  number; --指示單良品包裝總移轉數
      p_rc_good_carton_qty  number; --指示單良品(包;箱;捲)總移轉數


      p_move_to_op NUMBER;
      P_qty number;

     begin
         p_move_to_op := FL_RC_PKG.GET_NEXT_OP(p_rc_line_id,p_op,'N');

         FL_RC_PKG.RC_MOVE_QTY3
          (
         p_rc_line_id ,       --指示單id
         p_move_to_op ,       --移轉站別
         p_bom_resource_id ,      --bom resource id
         p_rc_resource_id ,       --rc resource id
         p_actual_prod_date ,    --實際產出日期
         p_acutal_shift_num ,  --實際產出BOM Calendar Shift
         P_ACTUAL_PROD_LINE_CODE,  --實際產出 線號
         p_rc_good_move_qty , --指示單良品總移轉數
         p_rc_ng_move_qty ,    --指示單不良品總移轉數
         p_rc_rj_move_qty ,    --指示單未判品總移轉數
         p_rc_good_packing_qty , --指示單良品包裝總移轉數
         p_rc_good_carton_qty  --指示單良品(包,箱,捲)總移轉數
          );

         IF p_qty_type =  1 THEN
            P_qty := p_rc_good_move_qty;
         ELSIF p_qty_type =  2 THEN
            P_qty := p_rc_ng_move_qty;
         ELSIF p_qty_type =  3 THEN
            P_qty := p_rc_rj_move_qty;
         ELSE
            P_qty := 0;
         END IF;

         RETURN(P_qty);
     end get_rc_move_qty2;
    ----------------------------------------------
    --get rc move qty
    function get_rc_move_qty_no_rework_rt
         (
          p_rc_line_id  number ,       --指示單id
          p_op  number ,       --移轉站別
          p_bom_resource_id number,      --bom resource id
          p_rc_resource_id number,       --rc resource id
          p_actual_prod_date in date,    --實際產出日期
          p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
          P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
          p_qty_type number--1 良品 2 不良品 3 未判品
         ) return number is
      p_rc_good_move_qty  number; --指示單良品總移轉數
      p_rc_ng_move_qty  number;    --指示單不良品總移轉數
      p_rc_rj_move_qty  number;    --指示單未判品總移轉數
      p_rc_good_packing_qty  number; --指示單良品包裝總移轉數
      p_rc_good_carton_qty  number; --指示單良品(包;箱;捲)總移轉數


      p_move_to_op NUMBER;
      P_qty number;

     begin
         p_move_to_op := FL_RC_PKG.GET_NEXT_OP(p_rc_line_id,p_op,'N');

         FL_RC_PKG.RC_MOVE_QTY_NO_REWORK_RT
          (
         p_rc_line_id ,       --指示單id
         p_move_to_op ,       --移轉站別
         p_bom_resource_id ,      --bom resource id
         p_rc_resource_id ,       --rc resource id
         p_actual_prod_date ,    --實際產出日期
         p_acutal_shift_num ,  --實際產出BOM Calendar Shift
         P_ACTUAL_PROD_LINE_CODE ,  --實際產出 線號
         p_rc_good_move_qty , --指示單良品總移轉數
         p_rc_ng_move_qty ,    --指示單不良品總移轉數
         p_rc_rj_move_qty ,    --指示單未判品總移轉數
         p_rc_good_packing_qty , --指示單良品包裝總移轉數
         p_rc_good_carton_qty  --指示單良品(包,箱,捲)總移轉數
          );

         IF p_qty_type =  1 THEN
            P_qty := p_rc_good_move_qty;
         ELSIF p_qty_type =  2 THEN
            P_qty := p_rc_ng_move_qty;
         ELSIF p_qty_type =  3 THEN
            P_qty := p_rc_rj_move_qty;
         ELSE
            P_qty := 0;
         END IF;

         RETURN(P_qty);
     end get_rc_move_qty_no_rework_rt;
    ----------------------------------------------
    --get flow card move qty
    function get_flow_card_move_qty
         (
          p_rc_line_id  number ,       --指示單id
          p_flow_card_id number,       --flow card id
          p_op  number ,               --移轉站別
          p_bom_resource_id number,      --bom resource id
          p_rc_resource_id number,       --rc resource id
          p_actual_prod_date in date,    --實際產出日期
          p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
          P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
          p_segment_code in number,      --節數
          p_qty_type number--1 良品 2 不良品 3 未判品
         ) return number is

      p_rc_good_move_qty  number; --指示單良品總移轉數
      p_rc_ng_move_qty  number;    --指示單不良品總移轉數
      p_rc_rj_move_qty  number;    --指示單未判品總移轉數


      p_move_to_op NUMBER;
      P_qty number;

     begin
         p_move_to_op := p_op;--FL_RC_PKG.GET_NEXT_OP(p_rc_line_id,p_op,'N');

        FL_RC_PKG.RC_FLOW_CARD_MOVE_QTY
        (
         p_rc_line_id ,       --指示單id
         p_move_to_op ,       --移轉站別
         'NET',--P_TYPE,            --ACC 累計移轉數 NET 淨移轉數(剩餘移轉數)
         p_flow_card_id ,       --flow card id
         p_bom_resource_id ,      --bom resource id
         p_rc_resource_id ,       --rc resource id
         p_actual_prod_date,    --實際產出日期
         p_acutal_shift_num,  --實際產出BOM Calendar Shift
         P_ACTUAL_PROD_LINE_CODE,  --實際產出 線號
         p_segment_code ,      --節數
         p_rc_good_move_qty, --指示單良品總移轉數
         p_rc_ng_move_qty,    --指示單不良品總移轉數
         p_rc_rj_move_qty   --指示單未判品總移轉數
        );


         IF p_qty_type =  1 THEN
            P_qty := p_rc_good_move_qty;
         ELSIF p_qty_type =  2 THEN
            P_qty := p_rc_ng_move_qty;
         ELSIF p_qty_type =  3 THEN
            P_qty := p_rc_rj_move_qty;
         ELSE
            P_qty := 0;
         END IF;

         RETURN(P_qty);
     end get_flow_card_move_qty;
----------------------------------------------
    --get flow card move qty
    function get_flow_card_accu_move_qty
         (
          p_rc_line_id  number ,       --指示單id
          p_flow_card_id number,       --flow card id
          p_op  number ,               --移轉站別
          p_bom_resource_id number,      --bom resource id
          p_rc_resource_id number,       --rc resource id
          p_actual_prod_date in date,    --實際產出日期
          p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
          P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
          p_segment_code in number,      --節數
          p_qty_type number--1 良品 2 不良品 3 未判品
         ) return number is

      p_rc_good_move_qty  number; --指示單良品總移轉數
      p_rc_ng_move_qty  number;    --指示單不良品總移轉數
      p_rc_rj_move_qty  number;    --指示單未判品總移轉數


      p_move_to_op NUMBER;
      P_qty number;

     begin
         p_move_to_op := p_op;--FL_RC_PKG.GET_NEXT_OP(p_rc_line_id,p_op,'N');

        FL_RC_PKG.RC_FLOW_CARD_MOVE_QTY
        (
         p_rc_line_id ,       --指示單id
         p_move_to_op ,       --移轉站別
         'ACC',--P_TYPE,            --ACC 累計移轉數 NET 淨移轉數(剩餘移轉數)
         p_flow_card_id ,       --flow card id
         p_bom_resource_id ,      --bom resource id
         p_rc_resource_id ,       --rc resource id
         p_actual_prod_date,    --實際產出日期
         p_acutal_shift_num,  --實際產出BOM Calendar Shift
         P_ACTUAL_PROD_LINE_CODE,  --實際產出 線號
         p_segment_code ,      --節數
         p_rc_good_move_qty, --指示單良品總移轉數
         p_rc_ng_move_qty,    --指示單不良品總移轉數
         p_rc_rj_move_qty   --指示單未判品總移轉數
        );


         IF p_qty_type =  1 THEN
            P_qty := p_rc_good_move_qty;
         ELSIF p_qty_type =  2 THEN
            P_qty := p_rc_ng_move_qty;
         ELSIF p_qty_type =  3 THEN
            P_qty := p_rc_rj_move_qty;
         ELSE
            P_qty := 0;
         END IF;

         RETURN(P_qty);
     end get_flow_card_accu_move_qty;
    -----------------------------------------------
    procedure get_flow_card_allow_move_qty
             (
              p_rc_line_id  number ,       --指示單id
              p_flow_card_id number,       --flow card id
              p_op  number ,               --移轉站別
              p_return_flag varchar2,
              p_bom_resource_id number,      --bom resource id
              p_rc_resource_id number,       --rc resource id
              p_actual_prod_date in date,    --實際產出日期
              p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
              P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
              p_segment_code in number,      --節數
              p_allow_good_move_qty out number, --指示單良品可移轉數
              p_allow_ng_move_qty out number,    --指示單不良品可移轉數
              p_allow_rj_move_qty out number    --指示單未判品可移轉數
             ) is
    /*
    declare
           p_rc_line_id number := 3199366;       --指示單id
           p_op number := 30;       --移轉站別
           p_return_flag varchar2(1) := 'N';
           --P_TYPE VARCHAR2(10) := 'NET';            --ACC 累計移轉數 NET 淨移轉數(剩餘移轉數)
           p_flow_card_id number := 73;       --flow card id
           p_bom_resource_id number;      --bom resource id
           p_rc_resource_id number;       --rc resource id
           p_actual_prod_date date;    --實際產出日期
           p_acutal_shift_num number;  --實際產出BOM Calendar Shift
           P_ACTUAL_PROD_LINE_CODE varchar2(10);  --實際產出 線號
           p_segment_code number;      --節數


           p_allow_good_move_qty number; --指示單良品可移轉數
           p_allow_ng_move_qty number;    --指示單不良品可移轉數
           p_allow_rj_move_qty number;    --指示單未判品可移轉數
           */

           x_rc_good_move_qty number := 0; --指示單良品已移轉總移轉數
           x_rc_ng_move_qty number := 0;   --指示單不良品已移轉總移轉數
           x_rc_rj_move_qty number := 0;   --指示單未判品已移轉總移轉數

           x_allow_good_move_qty number; --指示單良品可移轉數
           x_allow_ng_move_qty number;    --指示單不良品可移轉數
           x_allow_rj_move_qty number;    --指示單未判品可移轉數

           x_first_op number;
           x_previous_op number;

    begin



           if p_return_flag = 'N' then
               --假設為第一站,則本站未移轉數 - 總移轉數 即為可移轉數
               --判斷指示單第一站op
               BEGIN
                  select min(operation_num )
                  into x_first_op
                  from FL_RC_LINE_OP_ALL rlo
                  where rlo.rc_line_id = p_rc_line_id
                    ;
               EXCEPTION
                    WHEN OTHERS THEN NULL;
               END;
               if p_op = x_first_op then
                  --判斷第一站移轉數
                      FL_RC_PKG.RC_FLOW_CARD_MOVE_QTY
                      (
                       p_rc_line_id ,       --指示單id
                       p_op ,       --移轉站別
                       'ACC',--P_TYPE,            --ACC 累計移轉數 NET 淨移轉數(剩餘移轉數)
                       p_flow_card_id ,       --flow card id
                       p_bom_resource_id ,      --bom resource id
                       p_rc_resource_id ,       --rc resource id
                       p_actual_prod_date,    --實際產出日期
                       p_acutal_shift_num,  --實際產出BOM Calendar Shift
                       P_ACTUAL_PROD_LINE_CODE,  --實際產出 線號
                       p_segment_code ,      --節數
                       x_rc_good_move_qty, --指示單良品總移轉數
                       x_rc_ng_move_qty,    --指示單不良品總移轉數
                       x_rc_rj_move_qty   --指示單未判品總移轉數
                      );


                      select rl.prod_qty - (nvl(x_rc_good_move_qty,0)+nvl(x_rc_ng_move_qty,0)+nvl(x_rc_rj_move_qty,0))
                      into x_allow_good_move_qty
                      from fl_rc_lines_all rl
                      where rl.rc_line_id = p_rc_line_id
                          ;

                      x_allow_ng_move_qty := 0;   --指示單不良品可移轉數
                      x_allow_rj_move_qty := 0;    --指示單未判品可移轉數


               else--p_op <> x_min_op then
                    --判斷前一站的淨移轉數
                   BEGIN
                      select max(operation_num )
                      into x_previous_op
                      from FL_RC_LINE_OP_ALL rlo
                      where rlo.rc_line_id = p_rc_line_id
                         and operation_num < p_op
                        ;
                   EXCEPTION
                        WHEN OTHERS THEN NULL;
                   END;

                   if x_previous_op is not null then

                        FL_RC_PKG.RC_FLOW_CARD_MOVE_QTY
                        (
                         p_rc_line_id ,       --指示單id
                         x_previous_op ,       --移轉站別
                         'NET',--P_TYPE,            --ACC 累計移轉數 NET 淨移轉數(剩餘移轉數)
                         p_flow_card_id ,       --flow card id
                         p_bom_resource_id ,      --bom resource id
                         p_rc_resource_id ,       --rc resource id
                         p_actual_prod_date,    --實際產出日期
                         p_acutal_shift_num,  --實際產出BOM Calendar Shift
                         P_ACTUAL_PROD_LINE_CODE,  --實際產出 線號
                         p_segment_code ,      --節數
                         x_rc_good_move_qty, --指示單良品總移轉數
                         x_rc_ng_move_qty,    --指示單不良品總移轉數
                         x_rc_rj_move_qty   --指示單未判品總移轉數
                        );

                        x_allow_good_move_qty := x_rc_good_move_qty;
                        x_allow_ng_move_qty := 0;   --指示單不良品可移轉數
                        x_allow_rj_move_qty := 0;    --指示單未判品可移轉數

                   end if;

               end if;

           else--p_return_flag = 'Y'
                --退回都判斷本站淨移轉數
                FL_RC_PKG.RC_FLOW_CARD_MOVE_QTY
                (
                 p_rc_line_id ,       --指示單id
                 p_op ,       --移轉站別
                 'NET',--P_TYPE,            --ACC 累計移轉數 NET 淨移轉數(剩餘移轉數)
                 p_flow_card_id ,       --flow card id
                 p_bom_resource_id ,      --bom resource id
                 p_rc_resource_id ,       --rc resource id
                 p_actual_prod_date,    --實際產出日期
                 p_acutal_shift_num,  --實際產出BOM Calendar Shift
                 P_ACTUAL_PROD_LINE_CODE,  --實際產出 線號
                 p_segment_code ,      --節數
                 x_rc_good_move_qty, --指示單良品總移轉數
                 x_rc_ng_move_qty,    --指示單不良品總移轉數
                 x_rc_rj_move_qty   --指示單未判品總移轉數
                );

                x_allow_good_move_qty := x_rc_good_move_qty;
                x_allow_ng_move_qty := x_rc_ng_move_qty;   --指示單不良品可移轉數
                x_allow_rj_move_qty := x_rc_rj_move_qty;    --指示單未判品可移轉數
           end if;

           p_allow_good_move_qty := x_allow_good_move_qty; --指示單良品可移轉數
           p_allow_ng_move_qty := x_allow_ng_move_qty;    --指示單不良品可移轉數
           p_allow_rj_move_qty := x_allow_rj_move_qty;    --指示單未判品可移轉數
           /*
           dbms_output.put_line('p_allow_good_move_qty= '||to_char(p_allow_good_move_qty));
           dbms_output.put_line('p_allow_ng_move_qty= '||to_char(p_allow_ng_move_qty));
           dbms_output.put_line('p_allow_rj_move_qty= '||to_char(p_allow_rj_move_qty));
           */

    end;
    -------------------------------------------------
    function get_flow_card_allow_move_flag
             (
              p_rc_line_id  number ,       --指示單id
              p_flow_card_id number,       --flow card id
              p_op  number ,               --移轉站別
              p_return_flag varchar2,
              p_bom_resource_id number,      --bom resource id
              p_rc_resource_id number,       --rc resource id
              p_actual_prod_date in date,    --實際產出日期
              p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
              P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
              p_segment_code in number      --節數
             ) return varchar2 is
    /*
    declare
           p_rc_line_id number := 3199366;       --指示單id
           p_op number := 30;       --移轉站別
           p_return_flag varchar2(1) := 'N';
           --P_TYPE VARCHAR2(10) := 'NET';            --ACC 累計移轉數 NET 淨移轉數(剩餘移轉數)
           p_flow_card_id number := 73;       --flow card id
           p_bom_resource_id number;      --bom resource id
           p_rc_resource_id number;       --rc resource id
           p_actual_prod_date date;    --實際產出日期
           p_acutal_shift_num number;  --實際產出BOM Calendar Shift
           P_ACTUAL_PROD_LINE_CODE varchar2(10);  --實際產出 線號
           p_segment_code number;      --節數

           */


           x_allow_good_move_qty number; --指示單良品可移轉數
           x_allow_ng_move_qty number;    --指示單不良品可移轉數
           x_allow_rj_move_qty number;    --指示單未判品可移轉數


    begin
          fl_rc_utility_pkg.get_flow_card_allow_move_qty
                       (
                        p_rc_line_id  ,       --指示單id
                        p_flow_card_id ,       --flow card id
                        p_op  ,               --移轉站別
                        p_return_flag ,
                        p_bom_resource_id ,      --bom resource id
                        p_rc_resource_id ,       --rc resource id
                        p_actual_prod_date ,    --實際產出日期
                        p_acutal_shift_num ,  --實際產出BOM Calendar Shift
                        P_ACTUAL_PROD_LINE_CODE ,  --實際產出 線號
                        p_segment_code ,      --節數
                        x_allow_good_move_qty , --指示單良品可移轉數
                        x_allow_ng_move_qty ,    --指示單不良品可移轉數
                        x_allow_rj_move_qty    --指示單未判品可移轉數
                       );

           if x_allow_good_move_qty >0 or x_allow_ng_move_qty >0 or x_allow_rj_move_qty >0 then
              return('Y');
           else
              return('N');

           end if;


    end;
    ----------------------------------------------
    --get rc resource qty
     function get_rc_resource_qty
         (
          p_rc_line_id  number ,       --指示單id
          p_op  number ,       --移轉站別
          p_bom_resource_id number,      --bom resource id
          p_rc_resource_id number,       --rc resource id
          p_qty_type number--1 生產指示系統數量 2 生產指示系統確定進Oracle數量
         ) return number is
        p_rc_work_hours number;
        p_rc_trasc_work_hours number;

        P_qty number;

     begin

         FL_RC_PKG.RC_RESOURCE_QTY2
          (
          p_rc_line_id ,       --指示單id
          p_op ,       --移轉站別
          p_bom_resource_id ,      --bom resource id
          p_rc_resource_id ,       --rc resource id
          p_rc_work_hours ,    --指示單總工作時數
          p_rc_trasc_work_hours      --指示單總工作時數(進Oracle系統)
          );

         IF p_qty_type =  1 THEN
            P_qty := p_rc_work_hours;
         ELSIF p_qty_type =  2 THEN
            P_qty := p_rc_trasc_work_hours;
         ELSE
            P_qty := 0;
         END IF;

         RETURN(P_qty);
     end get_rc_resource_qty;
    ----------------------------------------------
    --get rc resource qty
     function get_rc_resource_qty2
         (
          p_rc_line_id  number ,       --指示單id
          p_op  number ,       --移轉站別
          p_bom_resource_id number,      --bom resource id
          p_rc_resource_id number,       --rc resource id
          p_actual_prod_date in date,    --實際產出日期
          p_acutal_shift_num in number,  --實際產出BOM Calendar Shift
          P_ACTUAL_PROD_LINE_CODE in varchar2,  --實際產出 線號
          p_qty_type number--1 生產指示系統數量 2 生產指示系統確定進Oracle數量
         ) return number is
        p_rc_work_hours number;
        p_rc_trasc_work_hours number;

        P_qty number;

     begin

         FL_RC_PKG.RC_RESOURCE_QTY3
          (
          p_rc_line_id ,       --指示單id
          p_op ,       --移轉站別
          p_bom_resource_id ,      --bom resource id
          p_rc_resource_id ,       --rc resource id
          p_actual_prod_date ,    --實際產出日期
          p_acutal_shift_num ,  --實際產出BOM Calendar Shift
          P_ACTUAL_PROD_LINE_CODE ,  --實際產出 線號
          p_rc_work_hours ,    --指示單總工作時數
          p_rc_trasc_work_hours      --指示單總工作時數(進Oracle系統)
          );

         IF p_qty_type =  1 THEN
            P_qty := p_rc_work_hours;
         ELSIF p_qty_type =  2 THEN
            P_qty := p_rc_trasc_work_hours;
         ELSE
            P_qty := 0;
         END IF;

         RETURN(P_qty);
     end get_rc_resource_qty2;
    --get rc no
    function get_rc_no
         (
          p_rc_line_id  number    --指示單id
         ) return varchar2 is
       x_rc_no varchar2(30);
    begin
        if p_rc_line_id is null then
          return(null);
        else
          begin
            select rc_no
            into x_rc_no
            from fl_rc_lines_all rl
            where rl.rc_line_id = p_rc_line_id;
          exception when others then null;
          end;
          return(x_rc_no);
        end if;
    end get_rc_no;
    --------------------------------------------------


    FUNCTION CHECK_APPROVE_RULE
             (
             p_rule_id in number,
             p_approver_class in varchar2,
             p_approve_category_type in varchar2,
             p_approver_category in varchar2,
             p_subinventory_code in varchar2,
             p_transfer_org_id in number,
             p_transfer_subinv_code in varchar2,
             p_user_id in number,
             p_issue_reason_code in varchar2,
             p_rs_source_type in varchar2,
             p_respons_emp_class in varchar2,
             p_rs_location_id in number,
             p_rs_assign_user_id in number,
             p_rs_transfer_location_id in number,
             p_rs_trs_assign_user_id in number
             ) RETURN VARCHAR2 IS

             x_exist_flag  varchar2(1) := 'N';
             x_count number;

             x_count10 number;
             x_count20 number;
             x_count30 number;
             x_count35 number;
             x_count40 number;
             x_count50 number;
             x_count60 number;
             x_count70 number;
             x_count80 number;
             x_count90 number;
             x_count100 number;
             x_count110 number;

    BEGIN
      if p_rule_id is null then
         x_exist_flag := 'Y';
      else
         x_exist_flag := 'Y';

         begin
           select nvl(rh.effective_flag,'N')
           into x_exist_flag
           from FL_RC_APPROVE_RULE_HEADERS_ALL rh
           where rh.rule_id = p_rule_id;
         exception when others then null;
         end;

         if x_exist_flag = 'Y' then
         --*************************************************
             --include 正向條件
             select
               sum(decode(rl.rule_type,10,1,0)),
               sum(decode(rl.rule_type,20,1,0)),
               sum(decode(rl.rule_type,30,1,0)),
               sum(decode(rl.rule_type,35,1,0)),
               sum(decode(rl.rule_type,40,1,0)),
               sum(decode(rl.rule_type,50,1,0)),
               sum(decode(rl.rule_type,60,1,0)),
               sum(decode(rl.rule_type,70,1,0)),
               sum(decode(rl.rule_type,80,1,0)),
               sum(decode(rl.rule_type,90,1,0)),
               sum(decode(rl.rule_type,100,1,0)),
               sum(decode(rl.rule_type,110,1,0))
             into
               x_count10,
               x_count20,
               x_count30,
               x_count35,
               x_count40,
               x_count50,
               x_count60,
               x_count70,
               x_count80,
               x_count90,
               x_count100,
               x_count110
             from FL_RC_APPROVE_RULE_LINES_ALL rl
             where rl.rule_id = p_rule_id
                    and rl.effective_flag = 'Y'
                    and rl.include_type = 'I'
                    ;

             --dbms_output.put_line('x_count10='||x_count10);

             if p_approver_category is not null and x_count10 > 0 then

                     select count(1)
                     into x_count
                     from FL_RC_APPROVE_RULE_LINES_ALL rl
                     where rl.rule_id = p_rule_id
                        and rl.effective_flag = 'Y'
                        and rl.include_type = 'I'
                        and rl.rule_type = 10 --簽核單別
                        and rl.type_code1 = p_approver_class
                        and rl.type_code2 = p_approver_category
                        ;
                     if  x_count = 0 then
                        x_exist_flag := 'N';
                     end if;


             end if;

             if p_subinventory_code is not null and x_exist_flag = 'Y' then

                 if x_count20 > 0 then--材料異動倉庫

                     select count(1)
                     into x_count
                     from FL_RC_APPROVE_RULE_LINES_ALL rl
                     where rl.rule_id = p_rule_id
                        and rl.effective_flag = 'Y'
                        and rl.include_type = 'I'
                        and rl.rule_type = 20 --材料異動倉庫
                        and rl.type_code1 = p_subinventory_code
                        and ((rl.type_code2 = p_transfer_org_id and rl.type_code2 is not null) or p_transfer_org_id is null)
                        and ((rl.type_code3 = p_transfer_subinv_code and rl.type_code3 is not null) or p_transfer_subinv_code is null)
                        ;
                     if  x_count = 0 then
                        x_exist_flag := 'N';
                     end if;

                 end if;


                 if x_count30 > 0 and x_exist_flag = 'Y' then--成品倉或材料倉

                     select count(1)
                     into x_count
                     from FL_RC_APPROVE_RULE_LINES_ALL rl
                     where rl.rule_id = p_rule_id
                        and rl.effective_flag = 'Y'
                        and rl.include_type = 'I'
                        and rl.rule_type = 30 --倉庫類別
                        and
                        (
                             (rl.type_code1 = 'FG'
                             and exists
                                 (
                                 SELECT 'x'
                                 FROM MTL_SECONDARY_INVENTORIES MSI,
                                      GL_CODE_COMBINATIONS GCC
                                 WHERE MSI.ORGANIZATION_ID =rl.ORGANIZATION_ID
                                      AND MSI.SECONDARY_INVENTORY_NAME = p_subinventory_code
                                      --and msi.asset_inventory = 1 --資產倉
                                      and GCC.SEGMENT4 IN
                                          (
                                          SELECT LV.LOOKUP_CODE
                                          FROM FL_LOOKUP_VALUES  LV
                                          WHERE LV.LOOKUP_TYPE = 'APPROVE_RULE_FG_SUB_ACCOUNT'
                                            AND LV.ENABLED_FLAG = 'Y'
                                            AND FL_RC_PKG2.LOOKUP_CODE_ACCESS2(MSI.organization_id,LV.LOOKUP_TYPE,LV.LOOKUP_CODE,LV.CONTROL_LEVEL,LV.CONTROL_LEVEL_ID,LV.ROWID) = 'Y'
                                          )
                                      AND MSI.MATERIAL_ACCOUNT = GCC.CODE_COMBINATION_ID
                                 )
                              ) or
                              (rl.type_code1 = 'MATERIAL'
                               and exists
                                 (
                                 SELECT 'x'
                                 FROM MTL_SECONDARY_INVENTORIES MSI,
                                      GL_CODE_COMBINATIONS GCC
                                 WHERE MSI.ORGANIZATION_ID =rl.ORGANIZATION_ID
                                      AND MSI.SECONDARY_INVENTORY_NAME = p_subinventory_code
                                      --and msi.asset_inventory = 1 --資產倉
                                      and GCC.SEGMENT4 not IN
                                          (
                                          SELECT LV.LOOKUP_CODE
                                          FROM FL_LOOKUP_VALUES  LV
                                          WHERE LV.LOOKUP_TYPE = 'APPROVE_RULE_FG_SUB_ACCOUNT'
                                            AND LV.ENABLED_FLAG = 'Y'
                                            AND FL_RC_PKG2.LOOKUP_CODE_ACCESS2(MSI.organization_id,LV.LOOKUP_TYPE,LV.LOOKUP_CODE,LV.CONTROL_LEVEL,LV.CONTROL_LEVEL_ID,LV.ROWID) = 'Y'
                                          )
                                      AND MSI.MATERIAL_ACCOUNT = GCC.CODE_COMBINATION_ID
                                 )
                              )
                        )
                        ;

                     if  x_count = 0 then
                        x_exist_flag := 'N';
                     end if;

                 end if;





                 if x_count35 > 0 and x_exist_flag = 'Y' then--保稅或非保稅倉

                     select count(1)
                     into x_count
                     from FL_RC_APPROVE_RULE_LINES_ALL rl
                     where rl.rule_id = p_rule_id
                        and rl.effective_flag = 'Y'
                        and rl.include_type = 'I'
                        and rl.rule_type = 35 --保稅或非保稅倉
                        and
                        (
                             (rl.type_code1 = 'BONDED'
                             and exists
                                 (
                                 SELECT 'x'
                                 FROM MTL_SECONDARY_INVENTORIES MSI
                                 WHERE MSI.ORGANIZATION_ID =rl.ORGANIZATION_ID
                                      AND MSI.SECONDARY_INVENTORY_NAME = p_subinventory_code
                                      AND MSI.DESCRIPTION NOT LIKE '%非保稅%'
                                 )
                              ) or
                              (rl.type_code1 = 'UNBONDED'
                               and exists
                                 (
                                 SELECT 'x'
                                 FROM MTL_SECONDARY_INVENTORIES MSI
                                 WHERE MSI.ORGANIZATION_ID =rl.ORGANIZATION_ID
                                      AND MSI.SECONDARY_INVENTORY_NAME = p_subinventory_code
                                      AND MSI.DESCRIPTION LIKE '%非保稅%'
                                 )
                              )
                        )
                        ;

                     if  x_count = 0 then
                        x_exist_flag := 'N';
                     end if;

                 end if;



                 if x_count40 > 0 and x_exist_flag = 'Y'  then--有此條件

                     select count(1)
                     into x_count
                     from FL_RC_APPROVE_RULE_LINES_ALL rl
                     where rl.rule_id = p_rule_id
                        and rl.effective_flag = 'Y'
                        and rl.include_type = 'I'
                        and rl.rule_type = 40 --倉庫資產分類
                        and
                        (
                             (rl.type_code1 = 'ASSET'
                             and exists
                                 (
                                 SELECT 'x'
                                 FROM MTL_SECONDARY_INVENTORIES MSI,
                                      GL_CODE_COMBINATIONS GCC
                                 WHERE MSI.ORGANIZATION_ID =rl.ORGANIZATION_ID
                                      AND MSI.SECONDARY_INVENTORY_NAME = p_subinventory_code
                                      and msi.asset_inventory = 1 --資產倉
                                      AND MSI.MATERIAL_ACCOUNT = GCC.CODE_COMBINATION_ID
                                 )
                              ) or
                              (rl.type_code1 = 'EXP'
                               and exists
                                 (
                                 SELECT 'x'
                                 FROM MTL_SECONDARY_INVENTORIES MSI,
                                      GL_CODE_COMBINATIONS GCC
                                 WHERE MSI.ORGANIZATION_ID =rl.ORGANIZATION_ID
                                      AND MSI.SECONDARY_INVENTORY_NAME = p_subinventory_code
                                      and msi.asset_inventory = 2 --費用倉
                                      AND MSI.MATERIAL_ACCOUNT = GCC.CODE_COMBINATION_ID
                                 )
                              )
                        )
                        ;

                     if  x_count = 0 then
                        x_exist_flag := 'N';
                     end if;

                 end if;

                 if x_count50 > 0 and x_exist_flag = 'Y'  then--有此條件

                     select count(1)
                     into x_count
                     from FL_RC_APPROVE_RULE_LINES_ALL rl
                     where rl.rule_id = p_rule_id
                        and rl.effective_flag = 'Y'
                        and rl.include_type = 'I'
                        and rl.rule_type = 50 --倉庫內含碼
                        and p_subinventory_code like '%'||rl.type_code1||'%'
                        ;
                     if  x_count = 0 then
                        x_exist_flag := 'N';
                     end if;

                 end if;
             end if;

             --單據申請人
             if p_user_id is not null and x_count60 > 0 and x_exist_flag = 'Y'  then


                     select count(1)
                     into x_count
                     from FL_RC_APPROVE_RULE_LINES_ALL rl
                     where rl.rule_id = p_rule_id
                        and rl.effective_flag = 'Y'
                        and rl.include_type = 'I'
                        and rl.rule_type = 60 --單據申請人
                        and  rl.type_code1 = p_user_id
                        ;
                     if  x_count = 0 then
                        x_exist_flag := 'N';
                     end if;

             end if;



             --異動原因
             if p_issue_reason_code is not null and x_count70 > 0 and x_exist_flag = 'Y'  then


                     select count(1)
                     into x_count
                     from FL_RC_APPROVE_RULE_LINES_ALL rl
                     where rl.rule_id = p_rule_id
                        and rl.effective_flag = 'Y'
                        and rl.include_type = 'I'
                        and rl.rule_type = 70 --異動原因
                        and  rl.type_code2 = p_issue_reason_code
                        ;
                     if  x_count = 0 then
                        x_exist_flag := 'N';
                     end if;

             end if;

             --資源儲位
             if (p_rs_location_id is not null OR p_rs_transfer_location_id IS NOT NULL)
               and x_count80 > 0 and x_exist_flag = 'Y'  then


                     IF p_rs_location_id is not null AND p_rs_transfer_location_id IS NOT NULL THEN
                         select count(1)
                         into x_count
                         from FL_RC_APPROVE_RULE_LINES_ALL rl
                         where rl.rule_id = p_rule_id
                            and rl.effective_flag = 'Y'
                            and rl.include_type = 'I'
                            and rl.rule_type = 80 --資源儲位
                            and  rl.type_code1 = p_rs_location_id
                            and  rl.type_code2 = p_rs_transfer_location_id;
                     ELSIF p_rs_location_id is not null THEN
                         select count(1)
                         into x_count
                         from FL_RC_APPROVE_RULE_LINES_ALL rl
                         where rl.rule_id = p_rule_id
                            and rl.effective_flag = 'Y'
                            and rl.include_type = 'I'
                            and rl.rule_type = 80 --資源儲位
                            and  rl.type_code1 = p_rs_location_id;
                     ELSIF p_rs_transfer_location_id is not null THEN
                         select count(1)
                         into x_count
                         from FL_RC_APPROVE_RULE_LINES_ALL rl
                         where rl.rule_id = p_rule_id
                            and rl.effective_flag = 'Y'
                            and rl.include_type = 'I'
                            and rl.rule_type = 80 --資源儲位
                            and rl.type_code2 = p_rs_transfer_location_id;
                     END IF;

                     if  x_count = 0 then
                        x_exist_flag := 'N';
                     end if;

             end if;

             --資源保管人
             if (p_rs_assign_user_id is not null OR p_rs_trs_assign_user_id IS NOT NULL)
               and x_count90 > 0 and x_exist_flag = 'Y'  then


                     IF p_rs_assign_user_id is not null AND  p_rs_trs_assign_user_id IS NOT NULL THEN
                         select count(1)
                         into x_count
                         from FL_RC_APPROVE_RULE_LINES_ALL rl
                         where rl.rule_id = p_rule_id
                            and rl.effective_flag = 'Y'
                            and rl.include_type = 'I'
                            and rl.rule_type = 90 --資源保管人
                            and  rl.type_code1 = p_rs_assign_user_id
                            and  rl.type_code2 =  p_rs_trs_assign_user_id;
                     ELSIF p_rs_assign_user_id is not null THEN
                         select count(1)
                         into x_count
                         from FL_RC_APPROVE_RULE_LINES_ALL rl
                         where rl.rule_id = p_rule_id
                            and rl.effective_flag = 'Y'
                            and rl.include_type = 'I'
                            and rl.rule_type = 90 --資源保管人
                            and  rl.type_code1 = p_rs_assign_user_id;
                     ELSIF  p_rs_trs_assign_user_id is not null THEN
                         select count(1)
                         into x_count
                         from FL_RC_APPROVE_RULE_LINES_ALL rl
                         where rl.rule_id = p_rule_id
                            and rl.effective_flag = 'Y'
                            and rl.include_type = 'I'
                            and rl.rule_type = 90 --資源保管人
                            and rl.type_code2 =  p_rs_trs_assign_user_id;
                     END IF;

                     if  x_count = 0 then
                        x_exist_flag := 'N';
                     end if;

             end if;

             --資源來源類別
             if p_rs_source_type is not null and x_count100 > 0 and x_exist_flag = 'Y'  then


                     select count(1)
                     into x_count
                     from FL_RC_APPROVE_RULE_LINES_ALL rl
                     where rl.rule_id = p_rule_id
                        and rl.effective_flag = 'Y'
                        and rl.include_type = 'I'
                        and rl.rule_type = 100 --資源來源類別
                        and rl.type_code1 = p_rs_source_type
                        ;
                     if  x_count = 0 then
                        x_exist_flag := 'N';
                     end if;

             end if;

             --責任部門
             if p_respons_emp_class is not null and x_count110 > 0 and x_exist_flag = 'Y'  then


                     select count(1)
                     into x_count
                     from FL_RC_APPROVE_RULE_LINES_ALL rl
                     where rl.rule_id = p_rule_id
                        and rl.effective_flag = 'Y'
                        and rl.include_type = 'I'
                        and rl.rule_type = 110 --責任部門
                        and rl.type_code1 = p_respons_emp_class
                        ;
                     if  x_count = 0 then
                        x_exist_flag := 'N';
                     end if;

             end if;


             --*******************************************************

             if  x_exist_flag = 'Y'  then
                   --exclude 反向條件
                   select
                     sum(decode(rl.rule_type,10,1,0)),
                     sum(decode(rl.rule_type,20,1,0)),
                     sum(decode(rl.rule_type,30,1,0)),
                     sum(decode(rl.rule_type,40,1,0)),
                     sum(decode(rl.rule_type,50,1,0)),
                     sum(decode(rl.rule_type,60,1,0)),
                     sum(decode(rl.rule_type,70,1,0)),
                     sum(decode(rl.rule_type,80,1,0)),
                     sum(decode(rl.rule_type,90,1,0)),
                     sum(decode(rl.rule_type,100,1,0)),
                     sum(decode(rl.rule_type,110,1,0))
                   into
                     x_count10,
                     x_count20,
                     x_count30,
                     x_count40,
                     x_count50,
                     x_count60,
                     x_count70,
                     x_count80,
                     x_count90,
                     x_count100,
                     x_count110
                   from FL_RC_APPROVE_RULE_LINES_ALL rl
                   where rl.rule_id = p_rule_id
                          and rl.effective_flag = 'Y'
                          and rl.include_type = 'E'
                          ;

                   --dbms_output.put_line('x_count10='||x_count10);

                   if p_approver_category is not null and x_count10 > 0 then

                           select count(1)
                           into x_count
                           from FL_RC_APPROVE_RULE_LINES_ALL rl
                           where rl.rule_id = p_rule_id
                              and rl.effective_flag = 'Y'
                              and rl.include_type = 'E'
                              and rl.rule_type = 10 --簽核單別
                              and rl.type_code1 = p_approver_class
                              and rl.type_code2 = p_approver_category
                              ;


                           if  x_count > 0 then
                              x_exist_flag := 'N';
                           end if;


                   end if;

                   if p_subinventory_code is not null and x_exist_flag = 'Y' then

                       if x_count20 > 0 then--有此條件

                           select count(1)
                           into x_count
                           from FL_RC_APPROVE_RULE_LINES_ALL rl
                           where rl.rule_id = p_rule_id
                              and rl.effective_flag = 'Y'
                              and rl.include_type = 'E'
                              and rl.rule_type = 20 --材料異動倉庫
                              and rl.type_code1 = p_subinventory_code
                              and ((rl.type_code2 = p_transfer_org_id and rl.type_code2 is not null) or p_transfer_org_id is null)
                              and ((rl.type_code3 = p_transfer_subinv_code and rl.type_code3 is not null) or p_transfer_subinv_code is null)
                              ;
                           if  x_count > 0 then
                              x_exist_flag := 'N';
                           end if;

                       end if;


                       if x_count30 > 0 and x_exist_flag = 'Y' then--有此條件

                           select count(1)
                           into x_count
                           from FL_RC_APPROVE_RULE_LINES_ALL rl
                           where rl.rule_id = p_rule_id
                              and rl.effective_flag = 'Y'
                              and rl.include_type = 'E'
                              and rl.rule_type = 30 --倉庫類別
                              and
                              (
                                   (rl.type_code1 = 'FG'
                                   and exists
                                       (
                                       SELECT 'x'
                                       FROM MTL_SECONDARY_INVENTORIES MSI,
                                            GL_CODE_COMBINATIONS GCC
                                       WHERE MSI.ORGANIZATION_ID =rl.ORGANIZATION_ID
                                            AND MSI.SECONDARY_INVENTORY_NAME = p_subinventory_code
                                            --and msi.asset_inventory = 1 --資產倉
                                            and GCC.SEGMENT4 IN ('116003','124302')
                                            AND MSI.MATERIAL_ACCOUNT = GCC.CODE_COMBINATION_ID
                                       )
                                    ) or
                                    (rl.type_code1 = 'MATERIAL'
                                     and exists
                                       (
                                       SELECT 'x'
                                       FROM MTL_SECONDARY_INVENTORIES MSI,
                                            GL_CODE_COMBINATIONS GCC
                                       WHERE MSI.ORGANIZATION_ID =rl.ORGANIZATION_ID
                                            AND MSI.SECONDARY_INVENTORY_NAME = p_subinventory_code
                                            --and msi.asset_inventory = 1 --資產倉
                                            and GCC.SEGMENT4 not IN ('116003','124302')
                                            AND MSI.MATERIAL_ACCOUNT = GCC.CODE_COMBINATION_ID
                                       )
                                    )
                              )
                              ;

                           if  x_count > 0 then
                              x_exist_flag := 'N';
                           end if;

                       end if;


                       if x_count40 > 0 and x_exist_flag = 'Y' then--有此條件

                           select count(1)
                           into x_count
                           from FL_RC_APPROVE_RULE_LINES_ALL rl
                           where rl.rule_id = p_rule_id
                              and rl.effective_flag = 'Y'
                              and rl.include_type = 'E'
                              and rl.rule_type = 40 --倉庫資產分類
                              and
                              (
                                   (rl.type_code1 = 'ASSET'
                                   and exists
                                       (
                                       SELECT 'x'
                                       FROM MTL_SECONDARY_INVENTORIES MSI,
                                            GL_CODE_COMBINATIONS GCC
                                       WHERE MSI.ORGANIZATION_ID =rl.ORGANIZATION_ID
                                            AND MSI.SECONDARY_INVENTORY_NAME = p_subinventory_code
                                            and msi.asset_inventory = 1 --資產倉
                                            AND MSI.MATERIAL_ACCOUNT = GCC.CODE_COMBINATION_ID
                                       )
                                    ) or
                                    (rl.type_code1 = 'EXP'
                                     and exists
                                       (
                                       SELECT 'x'
                                       FROM MTL_SECONDARY_INVENTORIES MSI,
                                            GL_CODE_COMBINATIONS GCC
                                       WHERE MSI.ORGANIZATION_ID =rl.ORGANIZATION_ID
                                            AND MSI.SECONDARY_INVENTORY_NAME = p_subinventory_code
                                            and msi.asset_inventory = 2 --費用倉
                                            AND MSI.MATERIAL_ACCOUNT = GCC.CODE_COMBINATION_ID
                                       )
                                    )
                              )
                              ;

                           if  x_count > 0 then
                              x_exist_flag := 'N';
                           end if;

                       end if;

                       if x_count50 > 0 and x_exist_flag = 'Y' then--有此條件

                           select count(1)
                           into x_count
                           from FL_RC_APPROVE_RULE_LINES_ALL rl
                           where rl.rule_id = p_rule_id
                              and rl.effective_flag = 'Y'
                              and rl.include_type = 'E'
                              and rl.rule_type = 50 --倉庫內含碼
                              and p_subinventory_code like '%'||rl.type_code1||'%'
                              ;
                           if  x_count > 0 then
                              x_exist_flag := 'N';
                           end if;

                       end if;
                   end if;

                   --單據申請人
                   if p_user_id is not null and x_count60 > 0 and x_exist_flag = 'Y' then


                           select count(1)
                           into x_count
                           from FL_RC_APPROVE_RULE_LINES_ALL rl
                           where rl.rule_id = p_rule_id
                              and rl.effective_flag = 'Y'
                              and rl.include_type = 'E'
                              and rl.rule_type = 60 --單據申請人
                              and  rl.type_code1 = p_user_id
                              ;
                           if  x_count > 0 then
                              x_exist_flag := 'N';
                           end if;

                   end if;

                   --異動原因
                   if p_issue_reason_code is not null and x_count70 > 0 and x_exist_flag = 'Y'  then


                           select count(1)
                           into x_count
                           from FL_RC_APPROVE_RULE_LINES_ALL rl
                           where rl.rule_id = p_rule_id
                              and rl.effective_flag = 'Y'
                              and rl.include_type = 'E'
                              and rl.rule_type = 70 --異動原因
                              and  rl.type_code2 = p_issue_reason_code
                              ;
                           if  x_count > 0 then
                              x_exist_flag := 'N';
                           end if;

                   end if;

                   --資源儲位
                   if (p_rs_location_id is not null OR p_rs_transfer_location_id IS NOT NULL)
                     and x_count80 > 0 and x_exist_flag = 'Y'  then


                           IF p_rs_location_id is not null AND p_rs_transfer_location_id IS NOT NULL THEN
                               select count(1)
                               into x_count
                               from FL_RC_APPROVE_RULE_LINES_ALL rl
                               where rl.rule_id = p_rule_id
                                  and rl.effective_flag = 'Y'
                                  and rl.include_type = 'E'
                                  and rl.rule_type = 80 --資源儲位
                                  and  rl.type_code1 = p_rs_location_id
                                  and  rl.type_code2 = p_rs_transfer_location_id;
                           ELSIF p_rs_location_id is not null THEN
                               select count(1)
                               into x_count
                               from FL_RC_APPROVE_RULE_LINES_ALL rl
                               where rl.rule_id = p_rule_id
                                  and rl.effective_flag = 'Y'
                                  and rl.include_type = 'E'
                                  and rl.rule_type = 80 --資源儲位
                                  and  rl.type_code1 = p_rs_location_id;
                           ELSIF p_rs_transfer_location_id is not null THEN
                               select count(1)
                               into x_count
                               from FL_RC_APPROVE_RULE_LINES_ALL rl
                               where rl.rule_id = p_rule_id
                                  and rl.effective_flag = 'Y'
                                  and rl.include_type = 'E'
                                  and rl.rule_type = 80 --資源儲位
                                  and rl.type_code2 = p_rs_transfer_location_id;
                           END IF;

                           if  x_count > 0 then
                              x_exist_flag := 'N';
                           end if;

                   end if;

                   --資源保管人
                   if (p_rs_assign_user_id is not null OR p_rs_trs_assign_user_id IS NOT NULL)
                     and x_count90 > 0 and x_exist_flag = 'Y'  then


                           IF p_rs_assign_user_id is not null AND  p_rs_trs_assign_user_id IS NOT NULL THEN
                               select count(1)
                               into x_count
                               from FL_RC_APPROVE_RULE_LINES_ALL rl
                               where rl.rule_id = p_rule_id
                                  and rl.effective_flag = 'Y'
                                  and rl.include_type = 'E'
                                  and rl.rule_type = 90 --資源保管人
                                  and  rl.type_code1 = p_rs_assign_user_id
                                  and  rl.type_code2 =  p_rs_trs_assign_user_id;
                           ELSIF p_rs_assign_user_id is not null THEN
                               select count(1)
                               into x_count
                               from FL_RC_APPROVE_RULE_LINES_ALL rl
                               where rl.rule_id = p_rule_id
                                  and rl.effective_flag = 'Y'
                                  and rl.include_type = 'E'
                                  and rl.rule_type = 90 --資源保管人
                                  and  rl.type_code1 = p_rs_assign_user_id;
                           ELSIF  p_rs_trs_assign_user_id is not null THEN
                               select count(1)
                               into x_count
                               from FL_RC_APPROVE_RULE_LINES_ALL rl
                               where rl.rule_id = p_rule_id
                                  and rl.effective_flag = 'Y'
                                  and rl.include_type = 'E'
                                  and rl.rule_type = 90 --資源保管人
                                  and rl.type_code2 =  p_rs_trs_assign_user_id;
                           END IF;

                           if  x_count > 0 then
                              x_exist_flag := 'N';
                           end if;

                   end if;

                   --資源來源類別
                   if p_rs_source_type is not null and x_count100 > 0 and x_exist_flag = 'Y'  then


                           select count(1)
                           into x_count
                           from FL_RC_APPROVE_RULE_LINES_ALL rl
                           where rl.rule_id = p_rule_id
                              and rl.effective_flag = 'Y'
                              and rl.include_type = 'E'
                              and rl.rule_type = 100 --資源來源類別
                              and rl.type_code1 = p_rs_source_type
                              ;
                           if  x_count > 0 then
                              x_exist_flag := 'N';
                           end if;

                   end if;

                   --責任部門
                   if p_respons_emp_class is not null and x_count110 > 0 and x_exist_flag = 'Y'  then


                           select count(1)
                           into x_count
                           from FL_RC_APPROVE_RULE_LINES_ALL rl
                           where rl.rule_id = p_rule_id
                              and rl.effective_flag = 'Y'
                              and rl.include_type = 'E'
                              and rl.rule_type = 110 --責任部門
                              and rl.type_code1 = p_respons_emp_class
                              ;
                           if  x_count > 0 then
                              x_exist_flag := 'N';
                           end if;

                   end if;


             end if;--exclude 反向條件 if  x_exist_flag = 'Y'  then

         --*******************************************************
         end if;--if x_exist_flag = 'Y' then

              --dbms_output.put_line('x_exist_flag='||x_exist_flag);
        end if;

        RETURN(x_exist_flag);

    END;
    ------------------------------------------------
    FUNCTION GET_APPROVE_HEADER_ID
             (
             p_organization_id in number,
             p_department_code in varchar2,
             p_emp_class_code in varchar2,
             p_approver_class in varchar2,
             p_approve_category_type in varchar2,
             p_approver_category in varchar2,
             p_subinventory_code in varchar2,
             p_transfer_org_id in number,
             p_transfer_subinv_code in varchar2,
             p_prod_line_code in varchar2,
             p_calendar_code in varchar2,
             p_shift_num in number,
             p_user_id in number,
             P_ISSUE_REASON_CODE in varchar2,
             p_bom_department_id in number
             ) RETURN NUMBER IS

     v_approve_header_id NUMBER;
     cursor c1 is
         select approve_header_id
         from
         (
         SELECT ah.approve_header_id,
                ah.user_id,
                ah.subinventory_code,
                ah.calendar_code,
                ah.shift_num,
                (
                  select count(rowid)
                  from fl_rc_app_prod_lines_all b
                  where ah.approve_header_id = b.approve_header_id
                     AND b.prod_line_code = p_prod_line_code
                ) prod_line_count
                FROM fl_rc_approver_headers_all ah
                WHERE 1=1
                  AND AH.FLOW_IDENTITY IS NULL --尋找條件不包含有FLOW IDENTIFY
                  AND NVL (ah.effective_end_date, SYSDATE) >= SYSDATE
                  AND ((ah.approver_class = p_approver_class and ah.approver_class is not null) -- 工單用料
                        or ah.approver_class is null)
                  --AND ah.approve_category_type = p_approve_category_type --工單用料的CATEGORY
                  AND ((ah.approver_category = p_approver_category and ah.approver_category is not null) -- 工單用料
                        or ah.approver_category is null)
                  AND ah.organization_id = p_organization_id
                  and ((ah.department_code = p_department_code and p_department_code is not null)
                       or
                       (ah.emp_class_code = p_emp_class_code and  p_emp_class_code is not null)
                      )
                  AND (ah.subinventory_code = p_subinventory_code
                            or ah.subinventory_code is null)
                  AND (ah.transfer_organization_id = p_transfer_org_id
                            or ah.transfer_organization_id is null)
                  AND (ah.transfer_subinv_code = p_transfer_subinv_code
                            or ah.transfer_subinv_code is null)
                  AND (ah.calendar_code = p_calendar_code
                            or ah.calendar_code is null)
                  AND (ah.shift_num = p_shift_num
                            or ah.shift_num is null)
                  AND (ah.user_id = p_user_id
                            or ah.user_id is null)
                  AND (ah.ISSUE_REASON_CODE = P_ISSUE_REASON_CODE
                            or ah.ISSUE_REASON_CODE is null)
                  AND (ah.bom_department_id = p_bom_department_id
                            or ah.bom_department_id is null)
                  and (
                      exists
                        (
                        select 1
                        from fl_rc_app_prod_lines_all b
                        where ah.approve_header_id = b.approve_header_id
                           AND b.prod_line_code = p_prod_line_code
                        )
                      or
                      not exists
                        (
                        select 1
                        from fl_rc_app_prod_lines_all b
                        where ah.approve_header_id = b.approve_header_id
                        )
                      )
                   AND CHECK_APPROVE_RULE--20101211 新增簽核表頭規則確認
                       (
                       ah.rule_id ,
                       p_approver_class ,
                       p_approve_category_type ,
                       p_approver_category ,
                       p_subinventory_code ,
                       p_transfer_org_id,
                       p_transfer_subinv_code,
                       p_user_id,
                       to_char(null),
                       to_char(null),
                       to_char(null),
                       to_number(null),
                       to_number(null),
                       to_number(null),
                       to_number(null)
                       ) = 'Y'
                 order by ah.rule_id ,ah.user_id ,ah.bom_department_id,ah.ISSUE_REASON_CODE,prod_line_count desc,ah.subinventory_code,
                          ah.transfer_organization_id,ah.transfer_subinv_code,ah.calendar_code,ah.shift_num
            ) where rownum = 1;

    BEGIN
            --判斷要用哪一組簽核設定
            v_approve_header_id := -1;
            for rec1 in c1 loop
                v_approve_header_id := rec1.approve_header_id;
            end loop;

            RETURN(v_approve_header_id);
    END GET_APPROVE_HEADER_ID;
   ------------------------------------------------
    FUNCTION GET_APPROVE_HEADER_ID2
             (
             p_par_rec in FL_RC_UTILITY_PKG.APPROVE_HEADER_REC_TYPE
             ) RETURN NUMBER IS

     v_approve_header_id NUMBER;


     cursor c1 is
         select approve_header_id
         from
         (
         SELECT ah.approve_header_id,
                ah.user_id,
                ah.subinventory_code,
                ah.calendar_code,
                ah.shift_num,
                (
                  select count(rowid)
                  from fl_rc_app_prod_lines_all b
                  where ah.approve_header_id = b.approve_header_id
                     AND b.prod_line_code = p_par_rec.prod_line_code
                ) prod_line_count
                FROM fl_rc_approver_headers_all ah
                WHERE 1=1
                  AND AH.FLOW_IDENTITY IS NULL --尋找條件不包含有FLOW IDENTIFY
                  AND NVL (ah.effective_end_date, SYSDATE) >= SYSDATE
                  AND ((ah.approver_class = p_par_rec.approver_class and ah.approver_class is not null) -- 工單用料
                        or ah.approver_class is null)
                  --AND ah.approve_category_type = p_par_rec.approve_category_type --工單用料的CATEGORY
                  AND ((ah.approver_category = p_par_rec.approver_category and ah.approver_category is not null) -- 工單用料
                        or ah.approver_category is null)
                  AND ah.organization_id = p_par_rec.organization_id
                  and ((ah.department_code = p_par_rec.department_code and p_par_rec.department_code is not null)
                       or
                       (ah.emp_class_code = p_par_rec.emp_class_code and  p_par_rec.emp_class_code is not null)
                      )
                  AND (ah.subinventory_code = p_par_rec.subinventory_code
                            or ah.subinventory_code is null)
                  AND (ah.transfer_organization_id = p_par_rec.transfer_org_id
                            or ah.transfer_organization_id is null)
                  AND (ah.transfer_subinv_code = p_par_rec.transfer_subinv_code
                            or ah.transfer_subinv_code is null)
                  AND (ah.calendar_code = p_par_rec.calendar_code
                            or ah.calendar_code is null)
                  AND (ah.shift_num = p_par_rec.shift_num
                            or ah.shift_num is null)
                  AND (ah.user_id = p_par_rec.user_id
                            or ah.user_id is null)
                  AND (ah.ISSUE_REASON_CODE = p_par_rec.ISSUE_REASON_CODE
                            or ah.ISSUE_REASON_CODE is null)
                  AND (ah.bom_department_id = p_par_rec.bom_department_id
                            or ah.bom_department_id is null)
                  and (
                      exists
                        (
                        select 1
                        from fl_rc_app_prod_lines_all b
                        where ah.approve_header_id = b.approve_header_id
                           AND b.prod_line_code = p_par_rec.prod_line_code
                        )
                      or
                      not exists
                        (
                        select 1
                        from fl_rc_app_prod_lines_all b
                        where ah.approve_header_id = b.approve_header_id
                        )
                      )
                   AND CHECK_APPROVE_RULE--20101211 新增簽核表頭規則確認
                       (
                       ah.rule_id ,
                       p_par_rec.approver_class ,
                       p_par_rec.approve_category_type ,
                       p_par_rec.approver_category ,
                       p_par_rec.subinventory_code ,
                       p_par_rec.transfer_org_id,
                       p_par_rec.transfer_subinv_code,
                       p_par_rec.user_id,
                       p_par_rec.ISSUE_REASON_CODE,
                       p_par_rec.RS_SOURCE_TYPE,
                       p_par_rec.RESPONS_EMP_CLASS,
                       p_par_rec.rs_location_id ,
                       p_par_rec.rs_assign_user_id ,
                       p_par_rec.rs_transfer_location_id ,
                       p_par_rec.rs_trs_assign_user_id
                       ) = 'Y'
                 order by ah.rule_id ,ah.user_id ,ah.bom_department_id,ah.ISSUE_REASON_CODE,prod_line_count desc,ah.subinventory_code,
                          ah.transfer_organization_id,ah.transfer_subinv_code,ah.calendar_code,ah.shift_num
            ) where rownum = 1;

    BEGIN
            --判斷要用哪一組簽核設定
            v_approve_header_id := -1;
            for rec1 in c1 loop
                v_approve_header_id := rec1.approve_header_id;
            end loop;

            RETURN(v_approve_header_id);
    END GET_APPROVE_HEADER_ID2;
    ----------------------------------------------
    --get good mtl return qty
    function get_good_mtl_return_qty
         (
          p_wip_entity_id in number,   --wip job id
          p_inventory_item_id in number,
          p_op_seq in number,
          p_organization_id in  number,
          p_get_type in number --1 get所有數量 2 get 已扣帳數
         ) return number is
         X_RETURN_NG_APPLY_QTY number;
         X_RETURN_NG_DEDUCT_QTY number;
    begin
            --判斷累計已扣帳生產性退料數
           Select nvl(sum(NVL(
                  DECODE(IH.FLOW_STATUS,1,IL.APPLY_QTY,2,IL.APPLY_QTY,3,IL.APPLY_QTY,6,IL.DEDUCT_QTY,0)
                  ,0)),0),
                  nvl(sum(NVL(
                  DECODE(IH.FLOW_STATUS,6,IL.DEDUCT_QTY,0)
                 ,0)),0)
           INTO X_RETURN_NG_APPLY_QTY,
                X_RETURN_NG_DEDUCT_QTY
           from
                FL_WIP_MTL_ISSUE_HEADERS_ALL IH,
                FL_WIP_MTL_ISSUE_LINESS_ALL IL
           WHERE IH.ISSUE_HEADER_ID = IL.ISSUE_HEADER_ID
                AND IH.ORGANIZATION_ID = p_organization_id
                AND IH.WIP_ENTITY_ID = nvl(p_wip_entity_id,IH.WIP_ENTITY_ID)
                AND IL.INVENTORY_ITEM_ID = p_inventory_item_id
                AND IL.OPERATION_SEQ_NUM = p_op_seq
                AND IH.ISSUE_TYPE = '3' --生產性退料單
                AND IL.APPLY_QTY > 0 --不含負料
                AND NOT EXISTS
                           (
                           SELECT 1
                           FROM FL_WIP_MTL_RETURN_ALL MR
                           WHERE MR.ISSUE_LINE_ID = IL.ISSUE_LINE_ID
                                AND MR.ISSUE_HEADER_ID = IH.ISSUE_HEADER_ID
                                AND MR.CODE = 'C' --良品退料
                           );
           if  p_get_type  = 1 then
               return(X_RETURN_NG_APPLY_QTY);
           elsif p_get_type  = 2 then
               return(X_RETURN_NG_DEDUCT_QTY);
           end if;
    end get_good_mtl_return_qty;
    ----------------------------------------------
    function get_lookup_meaning
         (
          p_organization_id in number,
          p_lookup_type in varchar2,
          p_code in varchar2
         ) return varchar2 is

    x_meaning varchar2(100);
    cursor c1 is
      select meaning
      from  fl_lookup_values flv
      where  lookup_type=p_lookup_type
          and lookup_code=p_code
          AND FL_RC_PKG2.LOOKUP_CODE_ACCESS2(p_organization_id,LOOKUP_TYPE,LOOKUP_CODE,CONTROL_LEVEL,CONTROL_LEVEL_ID,ROWID) = 'Y';

    begin
       OPEN C1;
       FETCH C1 INTO x_meaning;
       CLOSE C1;
       return(x_meaning);
    end get_lookup_meaning;
    ----------------------------------------------
    function get_default_category_set_name
         (
          p_organization_id in number
         ) return varchar2 is

         x_category_name varchar2(30);
    begin
          --設定ITEM CATEGORY KFF
          BEGIN
              select FLV.NOTE1
              into x_category_name
              from  FL_LOOKUP_VALUES FLV
              WHERE FLV.LOOKUP_TYPE  = 'RUN_CARD_PARAMETER'
               AND FLV.LOOKUP_CODE = 'DEFAULT_CATEGORY_SET'
               AND FL_RC_PKG2.LOOKUP_CODE_ACCESS2(p_organization_id,FLV.LOOKUP_TYPE,FLV.LOOKUP_CODE,FLV.CONTROL_LEVEL,FLV.CONTROL_LEVEL_ID,FLV.ROWID) = 'Y';
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
       return(nvl(x_category_name,'Inventory'));
    end get_default_category_set_name;
    ----------------------------------------------
    function job_close_flag
         (
          p_wip_entity_id in number
         ) return varchar2 is
         x_job_type number;
         x_count number;
         x_flag varchar2(1);
    begin
         begin
            select wdj.job_type
            into x_job_type --1 std 2 non std
            from wip_discrete_jobs wdj
            where wdj.wip_entity_id=p_wip_entity_id;
         exception when others then null;
         end;

         if x_job_type = 1 then
             --GET DEPT NAME
             BEGIN
                    SELECT 'Y'
                    INTO  x_flag
                    FROM FL_WIP_MTL_ISSUE_HEADERS_ALL IH,
                         FL_LOOKUP_VALUES FLV
                    WHERE IH.WIP_ENTITY_ID =  p_wip_entity_id
                        AND IH.APPLY_DEPARTMENT_CODE = FLV.LOOKUP_CODE
                        AND FLV.LOOKUP_TYPE  = 'RC PRODUCT LINE'
                        AND IH.FLOW_STATUS NOT IN ('4','5','7')
                        AND IH.ORGANIZATION_ID = FLV.CONTROL_LEVEL_ID
                        AND FLV.ATTRIBUTE16 = 'Y' --該部門使用JOB CLOSE CONTROL
                        and ROWNUM =1;
              EXCEPTION
                WHEN NO_DATA_FOUND THEN
                    return('N');
                WHEN OTHERS THEN NULL;
              END;

              return(nvl(x_flag,'N'));
         else
           return('N');
         end if;

    end job_close_flag;
    ----------------------------------------------
    function job_close_status
         (
          p_wip_entity_id in number
         ) return number is
         x_flow_status number;
    begin
         begin
            select jc.flow_status
            into x_flow_status
            from FL_JOB_CLOSE_HEADERS_ALL jc
            where jc.wip_entity_id =  p_wip_entity_id;
         exception when others then null;
         end;
         return(x_flow_status);

    end job_close_status;
    ----------------------------------------------
    function get_countersign_str
         (
          p_approve_class IN VARCHAR2,
          p_approve_category_type IN VARCHAR2,
          p_approve_category_code IN VARCHAR2,
          p_DOC_HEADER_ID  IN NUMBER,
          p_DOC_LINE_ID IN NUMBER,
          p_DOC_LINE_CODE IN VARCHAR2
          ) return VARCHAR2 IS

      X_STR VARCHAR2(1000);
    BEGIN
      begin

            select max( ltrim( SYS_CONNECT_BY_PATH( app_desc, ',' ), ',' ) )
            --replace(max(  SYS_CONNECT_BY_PATH( app_desc, ',' ) ) ,',',null)
            into X_STR
            from
            (select rownum r, a.app_desc   app_desc
            from
            (
            select fu.user_name||
                   DECODE(FRU.DEPARTMENT_CODE,NULL,NULL,
                   ' '||FL_RC_UTILITY_PKG.get_lookup_meaning(FRU.ORGANIZATION_ID,
                                                        'EMP CLASS',
                                                        FRU.DEPARTMENT_CODE
                                                        )
                          )
                   ||decode(rcs.qc_flag,null,null,' '||decode(rcs.qc_flag,'OK','合格',
                                                                                      'NG','退貨',
                                                                                      'SP','特採',
                                                                                      'FI','免檢')
                   )||' '||to_char(rcs.action_time,'mm/dd hh24:mi:ss') app_desc
            from FL_RC_COUNTERSIGN_ALL rcs,
                 fnd_user fu,
                 FL_RC_USERS_ALL   fru
            where rcs.approve_class = p_approve_class
                 AND RCS.approve_category_type =  p_approve_category_type
                 AND RCS.APPROVE_CATEGORY_CODE = p_approve_category_code
                 and rcs.approver_id = fu.user_id
                 AND rcs.approver_id = FRU.USER_ID(+)
                 AND RCS.ORGANIZATION_ID = FRU.ORGANIZATION_ID(+)
                 AND RCS.DOC_HEADER_ID = p_DOC_HEADER_ID
                 AND RCS.STATUS=2
                 and decode(p_DOC_LINE_ID,null,1,RCS.DOC_LINE_Id) =
                     decode(p_DOC_LINE_ID,null,1,p_DOC_LINE_ID)
                 and decode(p_DOC_LINE_CODE,null,'1',RCS.DOC_LINE_CODE) =
                     decode(p_DOC_LINE_CODE,null,'1',p_DOC_LINE_CODE)
            order by rcs.action_time
            ) a
            ) b
            start with b.r = 1
            connect by prior b.r+1 = b.r;
      exception when others then null;
      end;

      RETURN(X_STR);
    END get_countersign_str;
    ----------------------------------------------
    --檢核簽核歷史資料主簽核流程是否重複
    function check_approval_duplicate
         (
          p_approve_class IN VARCHAR2,
          p_doc_header_id IN NUMBER,
          p_doc_line_id   IN NUMBER,
          p_doc_line_code IN VARCHAR2
          ) return VARCHAR2 is

        x_count number;
    begin
       --判斷是否有等待簽核未簽核的資料
       select count(1)
       into x_count
       from FL_RC_APPROVER_HISTORY_ALL ah
       where ah.approve_class = p_approve_class
          and ah.doc_header_id = p_doc_header_id
          and ((ah.doc_line_id = p_doc_line_id and p_doc_line_id is not null)
              or p_doc_line_id is null)
          and ((ah.doc_line_code = p_doc_line_code and p_doc_line_code is not null)
              or p_doc_line_code is null)
          and ah.status = 2;

       if x_count > 0 then
          return('Y');
       else
          return(null);
       end if;
    end check_approval_duplicate;
    ----------------------------------------------
  FUNCTION FL_GET_RC_APPLY_QTY(P_ORGANIZATION_ID NUMBER,
                               P_RC_RESOURCE_ID  NUMBER,
                               P_LOCATION_ID     NUMBER,
                               P_ASSIGN_USER_ID  NUMBER,
                               P_LOT_NUMBER VARCHAR2) RETURN NUMBER IS
  V_QTY  NUMBER;

   BEGIN

        select NVL(SUM(roq.onhand_qty),0)
        INTO  V_QTY
         from FL_RS_ONHAND_QTY_ALL roq
         where roq.organization_id = P_ORGANIZATION_ID
             AND ROQ.RC_RESOURCE_ID = P_RC_RESOURCE_ID
            and roq.location_id = P_LOCATION_ID
            and roq.assign_user_id =  P_ASSIGN_USER_ID
            and decode(P_LOT_NUMBER,null,'a',roq.lot_number) =
                decode(P_LOT_NUMBER,null,'a',P_LOT_NUMBER)
        ;

   RETURN V_QTY;
   END FL_GET_RC_APPLY_QTY;
   ----------------------------------------------
    FUNCTION VALUE_TYPE_STRING(P_source_value IN VARCHAR2,
                                 P_data_type    IN VARCHAR2) RETURN VARCHAR2
     IS
      result_value VARCHAR2(2000);
      P_temp_source_value VARCHAR2(2000);
    BEGIN
        IF P_data_type = 'NUMBER' THEN
          result_value := P_source_value;
        ELSIF P_data_type = 'VARCHAR2' THEN
          select REPLACE(P_source_value, '''', '''''') into P_temp_source_value from dual;
          result_value := ''''||P_temp_source_value||'''';
        ELSIF  P_data_type = 'DATE' THEN
          result_value := 'to_date('''||P_source_value||''',''YYYY/MM/DD HH24:MI:SS'')';
        END IF;
          RETURN result_value;
    END VALUE_TYPE_STRING;
  ----------------------------------------------
    FUNCTION FL_GET_RS_ONHAND_QTY(P_ORGANIZATION_ID NUMBER,
                                 P_RC_RESOURCE_ID  NUMBER,
                                 P_LOCATION_ID     NUMBER,
                                 P_ASSIGN_USER_ID  NUMBER,
                                 P_LOT_NUMBER VARCHAR2) RETURN NUMBER IS
    V_QTY  NUMBER;

     BEGIN

          select NVL(SUM(roq.onhand_qty),0)
          INTO  V_QTY
           from FL_RS_ONHAND_QTY_ALL roq
           where roq.organization_id = P_ORGANIZATION_ID
               AND ROQ.RC_RESOURCE_ID = P_RC_RESOURCE_ID
              and decode(P_LOCATION_ID,null,1,roq.location_id)  = decode(P_LOCATION_ID,null,1,P_LOCATION_ID)
              and decode(P_ASSIGN_USER_ID,null,1,roq.assign_user_id) = decode(P_ASSIGN_USER_ID,null,1,P_ASSIGN_USER_ID)
              and decode(P_LOT_NUMBER,null,'a',roq.lot_number) =
                  decode(P_LOT_NUMBER,null,'a',P_LOT_NUMBER)
          ;

     RETURN V_QTY;
     END FL_GET_RS_ONHAND_QTY;
     ----------------------------------------------
END FL_RC_UTILITY_PKG ;

