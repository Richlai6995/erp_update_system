
  CREATE OR REPLACE EDITIONABLE PROCEDURE "APPS"."FL_INV0085_GET_GCC_P1" (
                  P_ORG_ID IN NUMBER,
                  P_COP_EMS_NO IN VARCHAR2, --'Foxlink_GFE'
                  P_ITEM_ID  IN NUMBER,
                  V_NO_ORIGINAL OUT NUMBER,
                  V_DEC_FACTOR  OUT NUMBER,
                  V_NAME_MODEL  OUT VARCHAR2,
                  V_CODE_TS     OUT VARCHAR2,
                  V_UNIT_NAME   OUT VARCHAR2,
                  V_QTY8_TOTAL  OUT NUMBER) IS
  P_START_CONTRACT VARCHAR2(30);
  P_END_CONTRACT   VARCHAR2(30);
  P_EFFECTIVE_DATE VARCHAR2(30);
  P_S_DECLARE_DATE VARCHAR2(30);
  P_E_DECLARE_DATE VARCHAR2(30);
  P_STATUS_FLAG    VARCHAR2(2);
  P_ACTIVE_F       VARCHAR2(2) := 'Y';
  P_USER_ID        number := -1;
  V_F_COP_EMS_NO   VARCHAR2(30);
  V_S_DECLARE_DATE date := fnd_date.canonical_to_date(P_S_DECLARE_DATE);
  V_E_DECLARE_DATE date := fnd_date.canonical_to_date(P_E_DECLARE_DATE);
  v_qty6           number;
  v_qty7           number;
  v_qty8           number;
  v_qty10          number; --jiayu add 成品復出
  v_qty11          number; --jiayu add 0664 料件復出 20100505
  -- 料件內銷/下角料數量/下角料出口數/下角料補稅數/下角料剩余數量  F201500002
  v_qty12    number; --料件內銷
  v_qty13    number; --下角料數量
  v_qty14    number; --下角料出口數
  v_qty15    number; --下角料補稅數
  v_qty16    number; --下角料剩余數量
  v_ex_total number; --1.增加欄位總出口數 20161221 add by jiayu
  v_reg_qty  number; --合同申請數

  CURSOR C_EMS IS
    SELECT EXP_CONTRACT_NO, BEGIN_DATE, END_DATE, F_COP_EMS_NO, mas.ems_no
      FROM GCC_TR_MAS MAS
     WHERE COP_EMS_NO = P_COP_EMS_NO
       and ems_type = 'H'
      -- AND EXP_CONTRACT_NO >= NVL(V_START_CONTRACT, EXP_CONTRACT_NO)
      -- AND EXP_CONTRACT_NO <= NVL(V_END_CONTRACT, EXP_CONTRACT_NO)
          --   AND MAS.END_DATE >= SYSDATE
       --AND MAS.END_DATE >= decode(P_ACTIVE_F, 'Y', SYSDATE, '01-Jan-2000') -- 2.增加條件Y(只抓生效的)
       AND MAS.END_DATE >= SYSDATE
     ORDER BY EXP_CONTRACT_NO;

  CURSOR C_IMG(p_f_cop_ems_no varchar2) IS
    SELECT GHI.G_NO,
           GII.COP_G_NO ITEM,
           GHI.INVENTORY_ITEM_ID,
           -- GHI.G_NO_ORIGINAL,
           GHI.G_NO_ORIGINAL,
           GII.G_NAME,
           GII.G_MODEL,
           GII.G_NAME||GII.G_MODEL G_NAME_MODEL,    --品名規格
           GII.CODE_T || GII.CODE_S CODE_TS,
           GLV.NAME1 UNIT_NAME,
           -- H.REG_QTY,
           '3' G_MARK,
          -- oo.ORGANIZATION_CODE,
           GII.dec_factor --No : F202100014 20210504 add by jiayu 比例因子
      FROM GCC_HB_IMG_ITEM              GHI,
           GCC_IB_IMG_ITEM              GII,
           GCC_LOOKUP_VALUES            GLV
           --,org_organization_definitions oo
     WHERE GHI.COP_EMS_NO = GII.COP_EMS_NO
      -- and GHI.organization_id = oo.ORGANIZATION_ID
       AND GHI.INVENTORY_ITEM_ID = GII.INVENTORY_ITEM_ID
       AND GHI.G_NO_ORIGINAL = GII.G_NO
       AND GII.UNIT = GLV.LOOKUP_CODE(+)
       AND GLV.ENABLED_FLAG(+) = 'Y'
       AND GLV.LOOKUP_TYPE(+) = 'MU'
       AND GII.COP_EMS_NO = P_COP_EMS_NO --'FOXLINK_GFQ'
       AND GHI.F_COP_EMS_NO = P_F_COP_EMS_NO
       AND GHI.ORGANIZATION_ID = P_ORG_ID
       AND GHI.INVENTORY_ITEM_ID = P_ITEM_ID
     ORDER BY GHI.G_NO; --'FQ20170002'--1211

  CURSOR C_BE(p_f_cop_ems_no varchar2,
              p_g_mark       varchar2,
              p_g_no         number,
              p_item_id      number) IS
    SELECT SUM(DECODE(GLM.I_E_MARK,
                      'E',
                      DECODE(MAS.TRADE_MODE,
                             '0615',
                             ITEM.QTY,
                             '0214',
                             ITEM.QTY,
                             '0200',
                             ITEM.QTY,
                             '0400',
                             ITEM.QTY,
                             --     '4600',
                             --      ITEM.QTY,
                             '4400',
                             ITEM.QTY,
                             '0700',
                             ITEM.QTY,
                             NULL))) G_QTY1, --出口累計
           SUM(DECODE(GLM.I_E_MARK,
                      'E',
                      DECODE(GLM.TRADE_MODE,
                             '0654',
                             ITEM.QTY,
                             '0255',
                             ITEM.QTY,
                             NULL))) G_QTY2, --轉出累計
           SUM(DECODE(GLM.I_E_MARK,
                      'I',
                      DECODE(GLM.TRADE_MODE,
                             '0615',
                             ITEM.QTY,
                             '0214',
                             ITEM.QTY,
                             '0200',
                             ITEM.QTY,
                             '0400',
                             ITEM.QTY,
                             '4600',
                             ITEM.QTY,
                             '4400',
                             ITEM.QTY,
                             '0700',
                             ITEM.QTY,
                             NULL))) G_QTY3, --進口數
           SUM(DECODE(GLM.I_E_MARK,
                      'I',
                      DECODE(GLM.TRADE_MODE,
                             '0654',
                             ITEM.QTY,
                             '0255',
                             ITEM.QTY,
                             NULL))) G_QTY4, --轉進累計
           SUM(DECODE(GLM.I_E_MARK,
                      'I',
                      DECODE(GLM.TRADE_MODE,
                             '0258',
                             ITEM.QTY,
                             '0657',
                             ITEM.QTY,
                             '9900', --20150113 ADD BY JIAYU  NO : F201500001配合轉溢余料件,需在進出口操作畫面增加監管方式:9900(其他)
                             ITEM.QTY,
                             NULL))) G_QTY5, --上期(其他)結轉
           SUM(DECODE(GLM.I_E_MARK,
                      'E',
                      DECODE(GLM.TRADE_MODE,
                             '0258',
                             ITEM.QTY,
                             '0657',
                             ITEM.QTY,
                             '9900', --20150113 ADD BY JIAYU  NO : F201500001配合轉溢余料件,需在進出口操作畫面增加監管方式:9900(其他)
                             ITEM.QTY,
                             NULL))) G_QTY9, --餘料(其他)轉出
           --JIAYU ADD 20080808 進料料件復出
           SUM(DECODE(GLM.I_E_MARK,
                      'E',
                      DECODE(GLM.TRADE_MODE, '4600', ITEM.QTY, NULL))) G_QTY10, --成品復出
           SUM(DECODE(GLM.I_E_MARK, --JIAYU ADD 0664 料件復出 20100505
                      'E',
                      DECODE(GLM.TRADE_MODE, '0664', ITEM.QTY, NULL))) G_QTY11, --料件復出
           SUM(DECODE(GLM.I_E_MARK,
                      'I',
                      DECODE(GLM.TRADE_MODE,
                             '0245',
                             ITEM.QTY,
                             '0644',
                             ITEM.QTY,
                             NULL))) G_QTY12, -- 料件內銷
           SUM(DECODE(GLM.I_E_MARK,
                      'I',
                      DECODE(GLM.TRADE_MODE,
                             '0865',
                             ITEM.QTY,
                             '0864',
                             ITEM.QTY,
                             NULL))) G_QTY14, --ADD 20150128 ADD BY JIAYU 0644 下角料出口數  F201500002
           SUM(DECODE(GLM.I_E_MARK,
                      'I',
                      DECODE(GLM.TRADE_MODE,
                             '0845',
                             ITEM.QTY,
                             '0844',
                             ITEM.QTY,
                             NULL))) G_QTY15 --ADD 20150128 ADD BY JIAYU 0644 下角料補稅數  F201500002
      FROM GCC_LIST_MAS GLM, GCC_LIST_ITEM ITEM, GCC_BE_MAS MAS
     WHERE GLM.PK_NO      = ITEM.MAS_PK_NO
       AND GLM.PK_NO = MAS.MAS_PK_NO
       AND MAS.STATUS_FLAG in ('B','2')
       AND MAS.COP_EMS_NO = P_COP_EMS_NO --'FOXLINK_GFQ'
       AND MAS.F_COP_EMS_NO = p_f_cop_ems_no --'FQ20170001'
       AND MAS.G_MARK = p_g_mark --'3'
       AND ITEM.EMS_G_NO = P_G_NO
       AND ITEM.INVENTORY_ITEM_ID = p_item_id
       AND GLM.TRADE_MODE NOT IN ('0110');

BEGIN
  V_QTY8_TOTAL := 0;
  FOR REC_EMS IN C_EMS LOOP
    --料件
    for rec_img in c_img(rec_ems.f_cop_ems_no) loop
      for rec_be in c_be(rec_ems.f_cop_ems_no,
                         rec_img.g_mark,
                         rec_img.g_no,
                         rec_img.INVENTORY_ITEM_ID) loop

        v_reg_qty := nvl(FLGCCEX021_PKG.get_ems_qty(rec_ems.f_cop_ems_no,
                                                    rec_img.g_no,
                                                    rec_img.g_mark,
                                                    rec_img.INVENTORY_ITEM_ID),
                         0); --合同申請數
        --v_reg_qty:=99999;
        v_qty6  := round(nvl(v_reg_qty, 0) - nvl(rec_be.g_qty3, 0) -
                         nvl(rec_be.g_qty4, 0) - nvl(rec_be.g_qty5, 0) +
                         nvl(rec_be.g_qty1, 0),
                         3); --申請余數=申請數-進口累計-轉進累計-上期(其他)結轉+出口累計
        v_qty12 := nvl(rec_be.g_qty12, 0); --料件內銷
        v_qty7  := round(nvl(FLGCCEX021_PKG.get_ex_cm_qty(P_COP_EMS_NO,
                                                          rec_ems.f_cop_ems_no,
                                                          rec_img.INVENTORY_ITEM_ID,
                                                          rec_img.g_no),
                             0),
                         3); --20161221 modi 核銷數不用扣內銷數，庫存數要扣內銷 小艷提出
        v_qty8 := round(nvl(rec_be.g_qty3, 0) + nvl(rec_be.g_qty4, 0) +
                        nvl(rec_be.g_qty5, 0) - nvl(v_qty7, 0) -
                        nvl(rec_be.g_qty1, 0) - nvl(rec_be.g_qty9, 0) -
                        nvl(rec_be.g_qty11, 0) - nvl(v_qty12, 0),
                        3); --20161221 modi 核銷數不用扣內銷數，庫存數要扣內銷 小艷提出

        v_qty10 := 0;
        v_qty11 := nvl(rec_be.g_qty11, 0); --JIAYU ADD 20100505 0644料件復出
        --20170310 add by jiayu start 內銷數量 No : G201700008 另新增料件內銷/下角料數量/下角料出口數/下角料補稅數/下角料剩余數量
        v_qty13 := round(nvl(FLGCCEX021_PKG.get_ex_dm_qty(P_COP_EMS_NO,
                                                          rec_ems.f_cop_ems_no,
                                                          rec_img.INVENTORY_ITEM_ID,
                                                          rec_img.g_no),
                             0),
                         3); --下角料數量 (要計算)
        -- v_qty13 :=8888;
        v_qty14    := nvl(rec_be.g_qty14, 0); --下角料出口數
        v_qty15    := nvl(rec_be.g_qty15, 0); --下角料補稅數
        v_qty16    := round(nvl((v_qty13 - v_qty14 - v_qty15), 0), 3); --下角料剩余數量 (要計算)*/下角料剩余數量=下角料數量-下角料出口數-下角料補稅數
        v_ex_total := 0;

        V_QTY8_TOTAL := V_QTY8_TOTAL + V_QTY8 ;

   dbms_output.put_line('f_cop_ems_no ='||rec_ems.f_cop_ems_no||' 品名規格='||rec_img.g_model||'憑證號=' || rec_img.g_no_original||' HS商品編碼='||rec_img.code_ts||
      ' 單位='||rec_img.unit_name);
   dbms_output.put_line('V_QTY8='||V_QTY8 );
      end loop;

      V_NO_ORIGINAL  := rec_img.g_no_original;
      V_DEC_FACTOR   := rec_img.dec_factor;
      V_NAME_MODEL   := rec_img.G_NAME_MODEL;
      V_CODE_TS      := rec_img.code_ts;
      V_UNIT_NAME    := rec_img.unit_name;

    end loop;
  end loop;
  V_QTY8_TOTAL := V_QTY8_TOTAL ;
exception
  when others then
    null;
END;
