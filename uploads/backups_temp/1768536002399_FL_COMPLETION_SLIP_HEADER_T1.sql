
  CREATE OR REPLACE EDITIONABLE TRIGGER "APPS"."FL_COMPLETION_SLIP_HEADER_T1" 
   AFTER INSERT
 ON  "FOXFL"."FL_RC_LINES_ALL#"     FOR EACH ROW
DECLARE

----------------------------------------------------------------------
--Trigger $Last Update By: Rich $Last Update Date: 2012/07/12
--
----------------------------------------------------------------------
x_create_flag varchar2(30);
BEGIN

--判斷是否自動新增 入庫票header
 begin
    SELECT lv.attribute24
    into x_create_flag
    FROM FL_LOOKUP_VALUES  lv
    WHERE  LOOKUP_TYPE = 'RC PRODUCT LINE'
     AND FL_RC_PKG2.LOOKUP_CODE_ACCESS2(:NEW.ORGANIZATION_ID,lv.LOOKUP_TYPE,lv.LOOKUP_CODE,lv.CONTROL_LEVEL,lv.CONTROL_LEVEL_ID,lv.rowid) = 'Y'
     and lv.lookup_code = :NEW.department_code
     ;
 exception when others then null;
 end;

 if x_create_flag = 'Y' then


      INSERT INTO FL_RC_TICKET_HEADERS_ALL
      (
      RC_LINE_ID,
      RC_NO,
      APPLY_USER_ID,
      APPLY_TIME,
      WIP_ENTITY_ID,
      INVENTORY_ITEM_ID,
      ORGANIZATION_ID,
      CREATED_BY,
      CREATION_DATE,
      LAST_UPDATED_BY,
      LAST_UPDATE_DATE,
      LAST_UPDATE_LOGIN,
      PROD_DATE,
      department_code,
      prod_line_code,
      shift_num,
      calendar_code
      ) values
      (
      :NEW.RC_LINE_ID,
      :NEW.RC_NO,
      :NEW.CREATED_BY,--APPLY_USER_ID,
      sysdate,--APPLY_TIME,
      :NEW.WIP_ENTITY_ID,
      (
      select wdj.primary_item_id
      from wip_discrete_jobs wdj
      where wdj.Wip_Entity_Id = :NEW.WIP_ENTITY_ID
      ),
      :NEW.ORGANIZATION_ID,
      :NEW.CREATED_BY,
      :NEW.CREATION_DATE,
      :NEW.LAST_UPDATED_BY,
      :NEW.LAST_UPDATE_DATE,
      :NEW.LAST_UPDATE_LOGIN,
      :NEW.PROD_DATE,
      :NEW.department_code,
      :NEW.prod_line_code,
      :NEW.shift_num,
      :NEW.calendar_code
      );
 end if;
END;


ALTER TRIGGER "APPS"."FL_COMPLETION_SLIP_HEADER_T1" ENABLE