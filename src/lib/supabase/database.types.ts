// GERADO por worker/scripts/gen-database-types.mjs — NÃO editar à mão.
// Regenerar após cada migration:
//   cd worker && SUPABASE_DB_URL='...' node scripts/gen-database-types.mjs
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      adm_conversations: {
        Row: {
          created_at: string;
          id: string;
          last_message_at: string;
          metadata: Json;
          obra_id: string | null;
          title: string | null;
          visitor_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
          metadata?: Json;
          obra_id?: string | null;
          title?: string | null;
          visitor_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
          metadata?: Json;
          obra_id?: string | null;
          title?: string | null;
          visitor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "adm_conversations_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      adm_messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          role: string;
          streaming: boolean;
        };
        Insert: {
          content?: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          role: string;
          streaming?: boolean;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          role?: string;
          streaming?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "adm_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "adm_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_runs: {
        Row: {
          agent_name: string;
          arquivo_id: string | null;
          cache_creation_tokens: number | null;
          cache_read_tokens: number | null;
          cost_usd: number | null;
          ended_at: string | null;
          error: string | null;
          id: string;
          input_tokens: number | null;
          latency_ms: number | null;
          model: string;
          output_tokens: number | null;
          pass: number;
          started_at: string;
          status: string;
        };
        Insert: {
          agent_name: string;
          arquivo_id?: string | null;
          cache_creation_tokens?: number | null;
          cache_read_tokens?: number | null;
          cost_usd?: number | null;
          ended_at?: string | null;
          error?: string | null;
          id?: string;
          input_tokens?: number | null;
          latency_ms?: number | null;
          model: string;
          output_tokens?: number | null;
          pass?: number;
          started_at?: string;
          status: string;
        };
        Update: {
          agent_name?: string;
          arquivo_id?: string | null;
          cache_creation_tokens?: number | null;
          cache_read_tokens?: number | null;
          cost_usd?: number | null;
          ended_at?: string | null;
          error?: string | null;
          id?: string;
          input_tokens?: number | null;
          latency_ms?: number | null;
          model?: string;
          output_tokens?: number | null;
          pass?: number;
          started_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_runs_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_arquivo_contextos: {
        Row: {
          agent_model: string | null;
          arquivo_id: string;
          context_md: string;
          context_path: string | null;
          created_at: string;
          doc_type: string;
          doc_type_confidence: number | null;
          id: string;
          schema_version: string;
          structure: Json | null;
          validated_at: string | null;
          validated_by: string | null;
          version: number;
        };
        Insert: {
          agent_model?: string | null;
          arquivo_id: string;
          context_md: string;
          context_path?: string | null;
          created_at?: string;
          doc_type: string;
          doc_type_confidence?: number | null;
          id?: string;
          schema_version: string;
          structure?: Json | null;
          validated_at?: string | null;
          validated_by?: string | null;
          version?: number;
        };
        Update: {
          agent_model?: string | null;
          arquivo_id?: string;
          context_md?: string;
          context_path?: string | null;
          created_at?: string;
          doc_type?: string;
          doc_type_confidence?: number | null;
          id?: string;
          schema_version?: string;
          structure?: Json | null;
          validated_at?: string | null;
          validated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "obra_arquivo_contextos_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_arquivo_contextos_validated_by_fkey";
            columns: ["validated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_arquivo_extracoes: {
        Row: {
          arquivo_id: string;
          created_at: string;
          discrepancies: Json | null;
          doc_type: string;
          doc_type_confidence: number | null;
          field_confidence: Json | null;
          human_overrides: Json | null;
          id: string;
          payload: Json;
          schema_version: string;
          verified_at: string | null;
          verified_by: string | null;
          verifier_findings: Json | null;
          version: number;
        };
        Insert: {
          arquivo_id: string;
          created_at?: string;
          discrepancies?: Json | null;
          doc_type: string;
          doc_type_confidence?: number | null;
          field_confidence?: Json | null;
          human_overrides?: Json | null;
          id?: string;
          payload: Json;
          schema_version: string;
          verified_at?: string | null;
          verified_by?: string | null;
          verifier_findings?: Json | null;
          version?: number;
        };
        Update: {
          arquivo_id?: string;
          created_at?: string;
          discrepancies?: Json | null;
          doc_type?: string;
          doc_type_confidence?: number | null;
          field_confidence?: Json | null;
          human_overrides?: Json | null;
          id?: string;
          payload?: Json;
          schema_version?: string;
          verified_at?: string | null;
          verified_by?: string | null;
          verifier_findings?: Json | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "obra_arquivo_extracoes_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_arquivo_extracoes_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_arquivos: {
        Row: {
          attempts: number;
          extract_attempts: number;
          id: string;
          last_error: string | null;
          lease_owner: string | null;
          lease_until: string | null;
          metadata: Json | null;
          mime: string | null;
          nome_original: string;
          normalize_attempts: number;
          obra_id: string;
          path: string;
          size: number | null;
          status: string;
          uploaded_at: string;
        };
        Insert: {
          attempts?: number;
          extract_attempts?: number;
          id?: string;
          last_error?: string | null;
          lease_owner?: string | null;
          lease_until?: string | null;
          metadata?: Json | null;
          mime?: string | null;
          nome_original: string;
          normalize_attempts?: number;
          obra_id: string;
          path: string;
          size?: number | null;
          status?: string;
          uploaded_at?: string;
        };
        Update: {
          attempts?: number;
          extract_attempts?: number;
          id?: string;
          last_error?: string | null;
          lease_owner?: string | null;
          lease_until?: string | null;
          metadata?: Json | null;
          mime?: string | null;
          nome_original?: string;
          normalize_attempts?: number;
          obra_id?: string;
          path?: string;
          size?: number | null;
          status?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_arquivos_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_avanco_fisico_disciplina_mes: {
        Row: {
          aderencia_pct: number | null;
          arquivo_id: string;
          config_version: string;
          contratado_acum_rs: number | null;
          contratado_rs: number | null;
          contrato_id: string;
          created_at: string;
          disciplina: string;
          extracao_version: number;
          fisico: boolean;
          id: string;
          mes_num: number;
          ordem: number;
          real_pendente: boolean;
          real_rs: number | null;
          status: string;
        };
        Insert: {
          aderencia_pct?: number | null;
          arquivo_id: string;
          config_version: string;
          contratado_acum_rs?: number | null;
          contratado_rs?: number | null;
          contrato_id: string;
          created_at?: string;
          disciplina: string;
          extracao_version: number;
          fisico: boolean;
          id?: string;
          mes_num: number;
          ordem: number;
          real_pendente?: boolean;
          real_rs?: number | null;
          status?: string;
        };
        Update: {
          aderencia_pct?: number | null;
          arquivo_id?: string;
          config_version?: string;
          contratado_acum_rs?: number | null;
          contratado_rs?: number | null;
          contrato_id?: string;
          created_at?: string;
          disciplina?: string;
          extracao_version?: number;
          fisico?: boolean;
          id?: string;
          mes_num?: number;
          ordem?: number;
          real_pendente?: boolean;
          real_rs?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_avanco_fisico_disciplina_mes_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_avanco_fisico_disciplina_mes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_bdi_deseq: {
        Row: {
          arquivo_id: string;
          bdi_declarado: number | null;
          bm_corrente: number | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          custo_direto_rs: number | null;
          custo_indireto_rs: number | null;
          custo_mensal_tempo_rs: number | null;
          delta_reducao_rs: number | null;
          desequilibrio_rs: number | null;
          extracao_version: number;
          farol: string | null;
          gasto_teorico_acum_rs: number | null;
          id: string;
          medicao_acum_rs: number | null;
          meses_contratuais: number | null;
          meses_extensao: number | null;
          overhead_mes_rs: number | null;
          pct_sobre_pv: number | null;
          projecao_extensao_rs: number | null;
          pv_rs: number | null;
          remunerado_acum_rs: number | null;
          status: string;
          valor_total_contrato_rs: number | null;
        };
        Insert: {
          arquivo_id: string;
          bdi_declarado?: number | null;
          bm_corrente?: number | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          custo_direto_rs?: number | null;
          custo_indireto_rs?: number | null;
          custo_mensal_tempo_rs?: number | null;
          delta_reducao_rs?: number | null;
          desequilibrio_rs?: number | null;
          extracao_version: number;
          farol?: string | null;
          gasto_teorico_acum_rs?: number | null;
          id?: string;
          medicao_acum_rs?: number | null;
          meses_contratuais?: number | null;
          meses_extensao?: number | null;
          overhead_mes_rs?: number | null;
          pct_sobre_pv?: number | null;
          projecao_extensao_rs?: number | null;
          pv_rs?: number | null;
          remunerado_acum_rs?: number | null;
          status?: string;
          valor_total_contrato_rs?: number | null;
        };
        Update: {
          arquivo_id?: string;
          bdi_declarado?: number | null;
          bm_corrente?: number | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          custo_direto_rs?: number | null;
          custo_indireto_rs?: number | null;
          custo_mensal_tempo_rs?: number | null;
          delta_reducao_rs?: number | null;
          desequilibrio_rs?: number | null;
          extracao_version?: number;
          farol?: string | null;
          gasto_teorico_acum_rs?: number | null;
          id?: string;
          medicao_acum_rs?: number | null;
          meses_contratuais?: number | null;
          meses_extensao?: number | null;
          overhead_mes_rs?: number | null;
          pct_sobre_pv?: number | null;
          projecao_extensao_rs?: number | null;
          pv_rs?: number | null;
          remunerado_acum_rs?: number | null;
          status?: string;
          valor_total_contrato_rs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_bdi_deseq_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_bdi_deseq_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_bdi_perda_mensal: {
        Row: {
          arquivo_id: string;
          bm: number | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          gasto_teorico_mes_rs: number | null;
          id: string;
          mes_label: string | null;
          ordem: number;
          perda_acum_rs: number | null;
          perda_mes_rs: number | null;
          remunerado_mes_rs: number | null;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          bm?: number | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          extracao_version: number;
          gasto_teorico_mes_rs?: number | null;
          id?: string;
          mes_label?: string | null;
          ordem: number;
          perda_acum_rs?: number | null;
          perda_mes_rs?: number | null;
          remunerado_mes_rs?: number | null;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          bm?: number | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          gasto_teorico_mes_rs?: number | null;
          id?: string;
          mes_label?: string | null;
          ordem?: number;
          perda_acum_rs?: number | null;
          perda_mes_rs?: number | null;
          remunerado_mes_rs?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_bdi_perda_mensal_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_bdi_perda_mensal_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_bdi_rubrica_tempo: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          desequilibrio_rs: number | null;
          extracao_version: number;
          gasto_teorico_acum_rs: number | null;
          id: string;
          incorrido_mes_rs: number | null;
          obs: string | null;
          ordem: number;
          pct_rubrica: number | null;
          remunerado_acum_rs: number | null;
          rubrica: string;
          status: string;
          tipo: string | null;
          valor_contrato_rs: number | null;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          desequilibrio_rs?: number | null;
          extracao_version: number;
          gasto_teorico_acum_rs?: number | null;
          id?: string;
          incorrido_mes_rs?: number | null;
          obs?: string | null;
          ordem: number;
          pct_rubrica?: number | null;
          remunerado_acum_rs?: number | null;
          rubrica: string;
          status?: string;
          tipo?: string | null;
          valor_contrato_rs?: number | null;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          desequilibrio_rs?: number | null;
          extracao_version?: number;
          gasto_teorico_acum_rs?: number | null;
          id?: string;
          incorrido_mes_rs?: number | null;
          obs?: string | null;
          ordem?: number;
          pct_rubrica?: number | null;
          remunerado_acum_rs?: number | null;
          rubrica?: string;
          status?: string;
          tipo?: string | null;
          valor_contrato_rs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_bdi_rubrica_tempo_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_bdi_rubrica_tempo_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_bdi_rubricas: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          descricao: string;
          eh_subtotal: boolean;
          extracao_version: number;
          id: string;
          ordem: number;
          pct_custo_direto: number | null;
          pct_receita: number | null;
          pct_receita_implicito: number | null;
          status: string;
          valor_rs: number | null;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          descricao: string;
          eh_subtotal?: boolean;
          extracao_version: number;
          id?: string;
          ordem: number;
          pct_custo_direto?: number | null;
          pct_receita?: number | null;
          pct_receita_implicito?: number | null;
          status?: string;
          valor_rs?: number | null;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          descricao?: string;
          eh_subtotal?: boolean;
          extracao_version?: number;
          id?: string;
          ordem?: number;
          pct_custo_direto?: number | null;
          pct_receita?: number | null;
          pct_receita_implicito?: number | null;
          status?: string;
          valor_rs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_bdi_rubricas_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_bdi_rubricas_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_chuvas: {
        Row: {
          arquivo_id: string;
          chuva_prev_total: number | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          eixo_real_vazio: boolean;
          extracao_version: number;
          frentes_nao_iniciadas: number | null;
          id: string;
          impedido_total_rs: number | null;
          liberado_total_rs: number | null;
          principal_impedido: string | null;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          chuva_prev_total?: number | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          eixo_real_vazio?: boolean;
          extracao_version: number;
          frentes_nao_iniciadas?: number | null;
          id?: string;
          impedido_total_rs?: number | null;
          liberado_total_rs?: number | null;
          principal_impedido?: string | null;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          chuva_prev_total?: number | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          eixo_real_vazio?: boolean;
          extracao_version?: number;
          frentes_nao_iniciadas?: number | null;
          id?: string;
          impedido_total_rs?: number | null;
          liberado_total_rs?: number | null;
          principal_impedido?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_chuvas_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_chuvas_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_chuvas_meses: {
        Row: {
          arquivo_id: string;
          chuva_prev_acum: number | null;
          chuva_prev_mm: number | null;
          chuva_real_acum: number | null;
          chuva_real_mm: number | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          dias_parados: number | null;
          dias_prev_5mm: number | null;
          extracao_version: number;
          farol: string | null;
          id: string;
          mes_obra: string | null;
          ordem: number;
          periodo: string | null;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          chuva_prev_acum?: number | null;
          chuva_prev_mm?: number | null;
          chuva_real_acum?: number | null;
          chuva_real_mm?: number | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          dias_parados?: number | null;
          dias_prev_5mm?: number | null;
          extracao_version: number;
          farol?: string | null;
          id?: string;
          mes_obra?: string | null;
          ordem: number;
          periodo?: string | null;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          chuva_prev_acum?: number | null;
          chuva_prev_mm?: number | null;
          chuva_real_acum?: number | null;
          chuva_real_mm?: number | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          dias_parados?: number | null;
          dias_prev_5mm?: number | null;
          extracao_version?: number;
          farol?: string | null;
          id?: string;
          mes_obra?: string | null;
          ordem?: number;
          periodo?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_chuvas_meses_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_chuvas_meses_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_condutas: {
        Row: {
          arquivo_id: string;
          categoria: string | null;
          clausula: string | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          data_sugerida: string | null;
          destinatario: string | null;
          dias_aberto: number | null;
          documento: string | null;
          extracao_version: number;
          farol: string | null;
          gatilho: string;
          id: string;
          motivo: string | null;
          norm_status: string;
          ordem: number;
          prioridade: string | null;
          responsavel: string | null;
          resultado_esperado: string | null;
          status: string | null;
        };
        Insert: {
          arquivo_id: string;
          categoria?: string | null;
          clausula?: string | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          data_sugerida?: string | null;
          destinatario?: string | null;
          dias_aberto?: number | null;
          documento?: string | null;
          extracao_version: number;
          farol?: string | null;
          gatilho: string;
          id?: string;
          motivo?: string | null;
          norm_status?: string;
          ordem: number;
          prioridade?: string | null;
          responsavel?: string | null;
          resultado_esperado?: string | null;
          status?: string | null;
        };
        Update: {
          arquivo_id?: string;
          categoria?: string | null;
          clausula?: string | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          data_sugerida?: string | null;
          destinatario?: string | null;
          dias_aberto?: number | null;
          documento?: string | null;
          extracao_version?: number;
          farol?: string | null;
          gatilho?: string;
          id?: string;
          motivo?: string | null;
          norm_status?: string;
          ordem?: number;
          prioridade?: string | null;
          responsavel?: string | null;
          resultado_esperado?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_condutas_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_condutas_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_cpu_coeficientes: {
        Row: {
          arquivo_id: string;
          codigo_cpu: string | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          custo_direto_unit: number | null;
          eqp_rs_un: number | null;
          extracao_version: number;
          id: string;
          mod_rs_un: number | null;
          ordem: number;
          pct_eqp: number | null;
          pct_mat: number | null;
          pct_mod: number | null;
          servico: string | null;
          status: string;
          tipo: string | null;
          unidade: string | null;
        };
        Insert: {
          arquivo_id: string;
          codigo_cpu?: string | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          custo_direto_unit?: number | null;
          eqp_rs_un?: number | null;
          extracao_version: number;
          id?: string;
          mod_rs_un?: number | null;
          ordem: number;
          pct_eqp?: number | null;
          pct_mat?: number | null;
          pct_mod?: number | null;
          servico?: string | null;
          status?: string;
          tipo?: string | null;
          unidade?: string | null;
        };
        Update: {
          arquivo_id?: string;
          codigo_cpu?: string | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          custo_direto_unit?: number | null;
          eqp_rs_un?: number | null;
          extracao_version?: number;
          id?: string;
          mod_rs_un?: number | null;
          ordem?: number;
          pct_eqp?: number | null;
          pct_mat?: number | null;
          pct_mod?: number | null;
          servico?: string | null;
          status?: string;
          tipo?: string | null;
          unidade?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_cpu_coeficientes_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_cpu_coeficientes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_cronograma_frente_mes: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          disciplina: string;
          extracao_version: number;
          id: string;
          mes_num: number;
          ordem: number;
          previsto_pct: number | null;
          real_pct: number | null;
          real_pendente: boolean;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          disciplina: string;
          extracao_version: number;
          id?: string;
          mes_num: number;
          ordem: number;
          previsto_pct?: number | null;
          real_pct?: number | null;
          real_pendente?: boolean;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          disciplina?: string;
          extracao_version?: number;
          id?: string;
          mes_num?: number;
          ordem?: number;
          previsto_pct?: number | null;
          real_pct?: number | null;
          real_pendente?: boolean;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_cronograma_frente_mes_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_cronograma_frente_mes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_cronograma_meses: {
        Row: {
          ano: number;
          competencia_chave: string | null;
          cronograma_id: string;
          id: string;
          mes: number;
          ordem: number;
          previsto_financeiro_declarado: number | null;
          previsto_pct: number | null;
          previsto_pct_acumulado: number | null;
          real_pct: number | null;
          real_pct_acumulado: number | null;
        };
        Insert: {
          ano: number;
          competencia_chave?: string | null;
          cronograma_id: string;
          id?: string;
          mes: number;
          ordem: number;
          previsto_financeiro_declarado?: number | null;
          previsto_pct?: number | null;
          previsto_pct_acumulado?: number | null;
          real_pct?: number | null;
          real_pct_acumulado?: number | null;
        };
        Update: {
          ano?: number;
          competencia_chave?: string | null;
          cronograma_id?: string;
          id?: string;
          mes?: number;
          ordem?: number;
          previsto_financeiro_declarado?: number | null;
          previsto_pct?: number | null;
          previsto_pct_acumulado?: number | null;
          real_pct?: number | null;
          real_pct_acumulado?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_cronograma_meses_cronograma_id_fkey";
            columns: ["cronograma_id"];
            isOneToOne: false;
            referencedRelation: "obra_cronogramas";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_cronograma_tarefas: {
        Row: {
          arquivo_id: string;
          codigo: string | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          data_inicio: string | null;
          data_inicio_real: string | null;
          data_termino: string | null;
          data_termino_real: string | null;
          desvio_dias: number | null;
          duracao_dias: number | null;
          eh_marco: boolean;
          extracao_version: number;
          id: string;
          nivel: number | null;
          nome: string | null;
          numero_item: string | null;
          ordem: number;
          pct_concluido: number | null;
          quantidade: number | null;
          status: string;
          unidade: string | null;
        };
        Insert: {
          arquivo_id: string;
          codigo?: string | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          data_inicio?: string | null;
          data_inicio_real?: string | null;
          data_termino?: string | null;
          data_termino_real?: string | null;
          desvio_dias?: number | null;
          duracao_dias?: number | null;
          eh_marco?: boolean;
          extracao_version: number;
          id?: string;
          nivel?: number | null;
          nome?: string | null;
          numero_item?: string | null;
          ordem: number;
          pct_concluido?: number | null;
          quantidade?: number | null;
          status?: string;
          unidade?: string | null;
        };
        Update: {
          arquivo_id?: string;
          codigo?: string | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          data_inicio?: string | null;
          data_inicio_real?: string | null;
          data_termino?: string | null;
          data_termino_real?: string | null;
          desvio_dias?: number | null;
          duracao_dias?: number | null;
          eh_marco?: boolean;
          extracao_version?: number;
          id?: string;
          nivel?: number | null;
          nome?: string | null;
          numero_item?: string | null;
          ordem?: number;
          pct_concluido?: number | null;
          quantidade?: number | null;
          status?: string;
          unidade?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_cronograma_tarefas_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_cronograma_tarefas_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_cronogramas: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          custo_total_obra: number | null;
          data_base: string | null;
          extracao_version: number;
          id: string;
          inicio_obra: string | null;
          status: string;
          termino_obra: string | null;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          custo_total_obra?: number | null;
          data_base?: string | null;
          extracao_version: number;
          id?: string;
          inicio_obra?: string | null;
          status?: string;
          termino_obra?: string | null;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          custo_total_obra?: number | null;
          data_base?: string | null;
          extracao_version?: number;
          id?: string;
          inicio_obra?: string | null;
          status?: string;
          termino_obra?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_cronogramas_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_cronogramas_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_curvas_c8: {
        Row: {
          alocado_pct: number | null;
          arquivo_id: string;
          capacidade_acum: number | null;
          capacidade_pct: number | null;
          config_version: string;
          contratado_acum_corte: number | null;
          contrato_id: string;
          created_at: string;
          executado_acum: number | null;
          extracao_version: number;
          id: string;
          liberacao_pct: number | null;
          liberado_acum: number | null;
          maior_gap_rs: number | null;
          status: string;
        };
        Insert: {
          alocado_pct?: number | null;
          arquivo_id: string;
          capacidade_acum?: number | null;
          capacidade_pct?: number | null;
          config_version: string;
          contratado_acum_corte?: number | null;
          contrato_id: string;
          created_at?: string;
          executado_acum?: number | null;
          extracao_version: number;
          id?: string;
          liberacao_pct?: number | null;
          liberado_acum?: number | null;
          maior_gap_rs?: number | null;
          status?: string;
        };
        Update: {
          alocado_pct?: number | null;
          arquivo_id?: string;
          capacidade_acum?: number | null;
          capacidade_pct?: number | null;
          config_version?: string;
          contratado_acum_corte?: number | null;
          contrato_id?: string;
          created_at?: string;
          executado_acum?: number | null;
          extracao_version?: number;
          id?: string;
          liberacao_pct?: number | null;
          liberado_acum?: number | null;
          maior_gap_rs?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_curvas_c8_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_curvas_c8_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_curvas_frentes: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contratado_rs: number | null;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          frente: string;
          gap_dominante_rs: number | null;
          id: string;
          ordem: number;
          produtividade_rs_hh: number | null;
          responsabilidade: string | null;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contratado_rs?: number | null;
          contrato_id: string;
          created_at?: string;
          extracao_version: number;
          frente: string;
          gap_dominante_rs?: number | null;
          id?: string;
          ordem: number;
          produtividade_rs_hh?: number | null;
          responsabilidade?: string | null;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contratado_rs?: number | null;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          frente?: string;
          gap_dominante_rs?: number | null;
          id?: string;
          ordem?: number;
          produtividade_rs_hh?: number | null;
          responsabilidade?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_curvas_frentes_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_curvas_frentes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_curvas_serie_mes: {
        Row: {
          arquivo_id: string;
          bm_corrente: number | null;
          capacidade_acum_rs: number | null;
          config_version: string;
          contratado_acum_rs: number | null;
          contrato_id: string;
          created_at: string;
          executado_acum_rs: number | null;
          extracao_version: number;
          id: string;
          liberado_acum_rs: number | null;
          mes_num: number;
          ordem: number;
          periodo_label: string | null;
          previsto_servicos_rs: number | null;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          bm_corrente?: number | null;
          capacidade_acum_rs?: number | null;
          config_version: string;
          contratado_acum_rs?: number | null;
          contrato_id: string;
          created_at?: string;
          executado_acum_rs?: number | null;
          extracao_version: number;
          id?: string;
          liberado_acum_rs?: number | null;
          mes_num: number;
          ordem: number;
          periodo_label?: string | null;
          previsto_servicos_rs?: number | null;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          bm_corrente?: number | null;
          capacidade_acum_rs?: number | null;
          config_version?: string;
          contratado_acum_rs?: number | null;
          contrato_id?: string;
          created_at?: string;
          executado_acum_rs?: number | null;
          extracao_version?: number;
          id?: string;
          liberado_acum_rs?: number | null;
          mes_num?: number;
          ordem?: number;
          periodo_label?: string | null;
          previsto_servicos_rs?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_curvas_serie_mes_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_curvas_serie_mes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_desequilibrio: {
        Row: {
          arquivo_id: string;
          categoria: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          id: string;
          ordem: number;
          pct_do_total: number | null;
          status: string;
          tela: string | null;
          valor_rs: number | null;
        };
        Insert: {
          arquivo_id: string;
          categoria: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          extracao_version: number;
          id?: string;
          ordem: number;
          pct_do_total?: number | null;
          status?: string;
          tela?: string | null;
          valor_rs?: number | null;
        };
        Update: {
          arquivo_id?: string;
          categoria?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          id?: string;
          ordem?: number;
          pct_do_total?: number | null;
          status?: string;
          tela?: string | null;
          valor_rs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_desequilibrio_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_desequilibrio_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_eventos_prazo: {
        Row: {
          arquivo_id: string;
          categoria: string | null;
          clausulas: string | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          critico: boolean | null;
          cross_matriz: string | null;
          data_fim: string | null;
          data_inicio: string | null;
          dias_atraso: number | null;
          ev_id: string | null;
          extracao_version: number;
          fonte: string | null;
          frente_trecho: string | null;
          id: string;
          impacta: boolean | null;
          janela_fim: string | null;
          janela_inicio: string | null;
          ordem: number;
          status: string;
          status_analise: string | null;
          titulo: string;
        };
        Insert: {
          arquivo_id: string;
          categoria?: string | null;
          clausulas?: string | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          critico?: boolean | null;
          cross_matriz?: string | null;
          data_fim?: string | null;
          data_inicio?: string | null;
          dias_atraso?: number | null;
          ev_id?: string | null;
          extracao_version: number;
          fonte?: string | null;
          frente_trecho?: string | null;
          id?: string;
          impacta?: boolean | null;
          janela_fim?: string | null;
          janela_inicio?: string | null;
          ordem: number;
          status?: string;
          status_analise?: string | null;
          titulo: string;
        };
        Update: {
          arquivo_id?: string;
          categoria?: string | null;
          clausulas?: string | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          critico?: boolean | null;
          cross_matriz?: string | null;
          data_fim?: string | null;
          data_inicio?: string | null;
          dias_atraso?: number | null;
          ev_id?: string | null;
          extracao_version?: number;
          fonte?: string | null;
          frente_trecho?: string | null;
          id?: string;
          impacta?: boolean | null;
          janela_fim?: string | null;
          janela_inicio?: string | null;
          ordem?: number;
          status?: string;
          status_analise?: string | null;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_eventos_prazo_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_eventos_prazo_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_faturamento_curvas: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          custo_total: number | null;
          data_corte: string | null;
          extracao_version: number;
          id: string;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          custo_total?: number | null;
          data_corte?: string | null;
          extracao_version: number;
          id?: string;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          custo_total?: number | null;
          data_corte?: string | null;
          extracao_version?: number;
          id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_faturamento_curvas_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_faturamento_curvas_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_faturamento_disciplina_mes: {
        Row: {
          ano: number | null;
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          deficit_rs: number | null;
          disciplina: string;
          extracao_version: number;
          id: string;
          mes: number | null;
          mes_num: number;
          ordem: number;
          periodo_label: string | null;
          previsto_rs: number | null;
          real_pendente: boolean;
          real_rs: number | null;
          status: string;
        };
        Insert: {
          ano?: number | null;
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          deficit_rs?: number | null;
          disciplina: string;
          extracao_version: number;
          id?: string;
          mes?: number | null;
          mes_num: number;
          ordem: number;
          periodo_label?: string | null;
          previsto_rs?: number | null;
          real_pendente?: boolean;
          real_rs?: number | null;
          status?: string;
        };
        Update: {
          ano?: number | null;
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          deficit_rs?: number | null;
          disciplina?: string;
          extracao_version?: number;
          id?: string;
          mes?: number | null;
          mes_num?: number;
          ordem?: number;
          periodo_label?: string | null;
          previsto_rs?: number | null;
          real_pendente?: boolean;
          real_rs?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_faturamento_disciplina_mes_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_faturamento_disciplina_mes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_faturamento_disciplina_resumo: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contratado_acum_rs: number | null;
          contratado_total_rs: number | null;
          contrato_id: string;
          created_at: string;
          disciplina: string;
          extracao_version: number;
          farol: string | null;
          id: string;
          ordem: number;
          pct: number | null;
          real_acum_rs: number | null;
          real_pendente: boolean;
          servico: boolean | null;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contratado_acum_rs?: number | null;
          contratado_total_rs?: number | null;
          contrato_id: string;
          created_at?: string;
          disciplina: string;
          extracao_version: number;
          farol?: string | null;
          id?: string;
          ordem: number;
          pct?: number | null;
          real_acum_rs?: number | null;
          real_pendente?: boolean;
          servico?: boolean | null;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contratado_acum_rs?: number | null;
          contratado_total_rs?: number | null;
          contrato_id?: string;
          created_at?: string;
          disciplina?: string;
          extracao_version?: number;
          farol?: string | null;
          id?: string;
          ordem?: number;
          pct?: number | null;
          real_acum_rs?: number | null;
          real_pendente?: boolean;
          servico?: boolean | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_faturamento_disciplina_resumo_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_faturamento_disciplina_resumo_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_faturamento_frente_macro: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contratado_acum_rs: number | null;
          contratado_total_rs: number | null;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          farol: string | null;
          frente: string;
          id: string;
          macro: string | null;
          ordem: number;
          pct: number | null;
          real_acum_rs: number | null;
          real_pendente: boolean;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contratado_acum_rs?: number | null;
          contratado_total_rs?: number | null;
          contrato_id: string;
          created_at?: string;
          extracao_version: number;
          farol?: string | null;
          frente: string;
          id?: string;
          macro?: string | null;
          ordem: number;
          pct?: number | null;
          real_acum_rs?: number | null;
          real_pendente?: boolean;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contratado_acum_rs?: number | null;
          contratado_total_rs?: number | null;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          farol?: string | null;
          frente?: string;
          id?: string;
          macro?: string | null;
          ordem?: number;
          pct?: number | null;
          real_acum_rs?: number | null;
          real_pendente?: boolean;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_faturamento_frente_macro_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_faturamento_frente_macro_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_faturamento_frente_trecho: {
        Row: {
          aderencia: number | null;
          arquivo_id: string;
          config_version: string;
          contratado_rs: number | null;
          contrato_id: string;
          created_at: string;
          deficit_rs: number | null;
          extracao_version: number;
          farol: string | null;
          frente: string;
          id: string;
          ordem: number;
          previsto_acum_rs: number | null;
          real_acum_rs: number | null;
          real_pendente: boolean;
          share_pct: number | null;
          status: string;
          trecho: string;
        };
        Insert: {
          aderencia?: number | null;
          arquivo_id: string;
          config_version: string;
          contratado_rs?: number | null;
          contrato_id: string;
          created_at?: string;
          deficit_rs?: number | null;
          extracao_version: number;
          farol?: string | null;
          frente: string;
          id?: string;
          ordem: number;
          previsto_acum_rs?: number | null;
          real_acum_rs?: number | null;
          real_pendente?: boolean;
          share_pct?: number | null;
          status?: string;
          trecho: string;
        };
        Update: {
          aderencia?: number | null;
          arquivo_id?: string;
          config_version?: string;
          contratado_rs?: number | null;
          contrato_id?: string;
          created_at?: string;
          deficit_rs?: number | null;
          extracao_version?: number;
          farol?: string | null;
          frente?: string;
          id?: string;
          ordem?: number;
          previsto_acum_rs?: number | null;
          real_acum_rs?: number | null;
          real_pendente?: boolean;
          share_pct?: number | null;
          status?: string;
          trecho?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_faturamento_frente_trecho_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_faturamento_frente_trecho_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_faturamento_frentes: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contratado_acum: number | null;
          contratado_total: number | null;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          farol: string | null;
          frente: string;
          id: string;
          ordem: number;
          pct: number | null;
          real_acum: number | null;
          servico: boolean | null;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contratado_acum?: number | null;
          contratado_total?: number | null;
          contrato_id: string;
          created_at?: string;
          extracao_version: number;
          farol?: string | null;
          frente: string;
          id?: string;
          ordem: number;
          pct?: number | null;
          real_acum?: number | null;
          servico?: boolean | null;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contratado_acum?: number | null;
          contratado_total?: number | null;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          farol?: string | null;
          frente?: string;
          id?: string;
          ordem?: number;
          pct?: number | null;
          real_acum?: number | null;
          servico?: boolean | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_faturamento_frentes_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_faturamento_frentes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_faturamento_meses: {
        Row: {
          ano: number;
          contratado_rs: number | null;
          contratado_rs_acumulado: number | null;
          curva_id: string;
          id: string;
          mes: number;
          ordem: number;
          projecao_rs: number | null;
          projecao_rs_acumulado: number | null;
          real_rs: number | null;
          real_rs_acumulado: number | null;
          tipo_projecao: string | null;
        };
        Insert: {
          ano: number;
          contratado_rs?: number | null;
          contratado_rs_acumulado?: number | null;
          curva_id: string;
          id?: string;
          mes: number;
          ordem: number;
          projecao_rs?: number | null;
          projecao_rs_acumulado?: number | null;
          real_rs?: number | null;
          real_rs_acumulado?: number | null;
          tipo_projecao?: string | null;
        };
        Update: {
          ano?: number;
          contratado_rs?: number | null;
          contratado_rs_acumulado?: number | null;
          curva_id?: string;
          id?: string;
          mes?: number;
          ordem?: number;
          projecao_rs?: number | null;
          projecao_rs_acumulado?: number | null;
          real_rs?: number | null;
          real_rs_acumulado?: number | null;
          tipo_projecao?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_faturamento_meses_curva_id_fkey";
            columns: ["curva_id"];
            isOneToOne: false;
            referencedRelation: "obra_faturamento_curvas";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_faturamento_serie_mes: {
        Row: {
          ano: number | null;
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          dimensao: string;
          extracao_version: number;
          id: string;
          item: string;
          mes: number | null;
          mes_num: number;
          ordem: number;
          previsto_rs: number | null;
          real_rs: number | null;
          status: string;
        };
        Insert: {
          ano?: number | null;
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          dimensao: string;
          extracao_version: number;
          id?: string;
          item: string;
          mes?: number | null;
          mes_num: number;
          ordem: number;
          previsto_rs?: number | null;
          real_rs?: number | null;
          status?: string;
        };
        Update: {
          ano?: number | null;
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          dimensao?: string;
          extracao_version?: number;
          id?: string;
          item?: string;
          mes?: number | null;
          mes_num?: number;
          ordem?: number;
          previsto_rs?: number | null;
          real_rs?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_faturamento_serie_mes_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_faturamento_serie_mes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_indiretos_base: {
        Row: {
          adm_local_cheio: number | null;
          adm_local_mensal: number | null;
          arquivo_id: string;
          bm_corrente: number | null;
          config_version: string;
          contratado_acum: number | null;
          contrato_id: string;
          created_at: string;
          custo_direto: number | null;
          desequilibrio_extensao: number | null;
          desequilibrio_total: number | null;
          extensao_meses: number | null;
          extracao_version: number;
          gasto_acum: number | null;
          id: string;
          medido_acum: number | null;
          metodo_ativo: string | null;
          percent_pv: number | null;
          prazo_meses: number | null;
          pv: number | null;
          real_acum: number | null;
          reducao_escopo: number | null;
          reducao_pct: number | null;
          status: string;
        };
        Insert: {
          adm_local_cheio?: number | null;
          adm_local_mensal?: number | null;
          arquivo_id: string;
          bm_corrente?: number | null;
          config_version: string;
          contratado_acum?: number | null;
          contrato_id: string;
          created_at?: string;
          custo_direto?: number | null;
          desequilibrio_extensao?: number | null;
          desequilibrio_total?: number | null;
          extensao_meses?: number | null;
          extracao_version: number;
          gasto_acum?: number | null;
          id?: string;
          medido_acum?: number | null;
          metodo_ativo?: string | null;
          percent_pv?: number | null;
          prazo_meses?: number | null;
          pv?: number | null;
          real_acum?: number | null;
          reducao_escopo?: number | null;
          reducao_pct?: number | null;
          status?: string;
        };
        Update: {
          adm_local_cheio?: number | null;
          adm_local_mensal?: number | null;
          arquivo_id?: string;
          bm_corrente?: number | null;
          config_version?: string;
          contratado_acum?: number | null;
          contrato_id?: string;
          created_at?: string;
          custo_direto?: number | null;
          desequilibrio_extensao?: number | null;
          desequilibrio_total?: number | null;
          extensao_meses?: number | null;
          extracao_version?: number;
          gasto_acum?: number | null;
          id?: string;
          medido_acum?: number | null;
          metodo_ativo?: string | null;
          percent_pv?: number | null;
          prazo_meses?: number | null;
          pv?: number | null;
          real_acum?: number | null;
          reducao_escopo?: number | null;
          reducao_pct?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_indiretos_base_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_indiretos_base_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_indiretos_itens: {
        Row: {
          arquivo_id: string | null;
          config_version: string | null;
          contrato_id: string;
          created_at: string;
          custo_contr: number | null;
          custo_real: number | null;
          delta_custo: number | null;
          extracao_version: string | null;
          grupo: string;
          id: string;
          ordem: number;
          qtd_contr: number | null;
          qtd_real: number | null;
          status: string;
        };
        Insert: {
          arquivo_id?: string | null;
          config_version?: string | null;
          contrato_id: string;
          created_at?: string;
          custo_contr?: number | null;
          custo_real?: number | null;
          delta_custo?: number | null;
          extracao_version?: string | null;
          grupo: string;
          id?: string;
          ordem: number;
          qtd_contr?: number | null;
          qtd_real?: number | null;
          status?: string;
        };
        Update: {
          arquivo_id?: string | null;
          config_version?: string | null;
          contrato_id?: string;
          created_at?: string;
          custo_contr?: number | null;
          custo_real?: number | null;
          delta_custo?: number | null;
          extracao_version?: string | null;
          grupo?: string;
          id?: string;
          ordem?: number;
          qtd_contr?: number | null;
          qtd_real?: number | null;
          status?: string;
        };
        Relationships: [];
      };
      obra_indiretos_metodos: {
        Row: {
          arquivo_id: string;
          ativo: boolean;
          codigo: string | null;
          comparacao: string | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          defensabilidade: number | null;
          desequilibrio_rs: number | null;
          extracao_version: number;
          id: string;
          medido_rs: number | null;
          metodo: string;
          obs: string | null;
          ordem: number;
          pendente: boolean;
          status: string;
          valor_a: number | null;
          valor_b: number | null;
        };
        Insert: {
          arquivo_id: string;
          ativo?: boolean;
          codigo?: string | null;
          comparacao?: string | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          defensabilidade?: number | null;
          desequilibrio_rs?: number | null;
          extracao_version: number;
          id?: string;
          medido_rs?: number | null;
          metodo: string;
          obs?: string | null;
          ordem: number;
          pendente?: boolean;
          status?: string;
          valor_a?: number | null;
          valor_b?: number | null;
        };
        Update: {
          arquivo_id?: string;
          ativo?: boolean;
          codigo?: string | null;
          comparacao?: string | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          defensabilidade?: number | null;
          desequilibrio_rs?: number | null;
          extracao_version?: number;
          id?: string;
          medido_rs?: number | null;
          metodo?: string;
          obs?: string | null;
          ordem?: number;
          pendente?: boolean;
          status?: string;
          valor_a?: number | null;
          valor_b?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_indiretos_metodos_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_indiretos_metodos_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_insumo_excedente: {
        Row: {
          arquivo_id: string;
          classe_abc: string | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          delta_real_pct: number | null;
          delta_rs: number | null;
          excedente_pct: number | null;
          extracao_version: number;
          farol: string | null;
          id: string;
          indice_pendente: boolean;
          insumo: string;
          ordem: number;
          preco_orcado_rs: number | null;
          preco_ref_real_rs: number | null;
          qtd_orcada: number | null;
          snapshot_label: string | null;
          status: string;
          teto_ipca_pct: number | null;
        };
        Insert: {
          arquivo_id: string;
          classe_abc?: string | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          delta_real_pct?: number | null;
          delta_rs?: number | null;
          excedente_pct?: number | null;
          extracao_version: number;
          farol?: string | null;
          id?: string;
          indice_pendente?: boolean;
          insumo: string;
          ordem: number;
          preco_orcado_rs?: number | null;
          preco_ref_real_rs?: number | null;
          qtd_orcada?: number | null;
          snapshot_label?: string | null;
          status?: string;
          teto_ipca_pct?: number | null;
        };
        Update: {
          arquivo_id?: string;
          classe_abc?: string | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          delta_real_pct?: number | null;
          delta_rs?: number | null;
          excedente_pct?: number | null;
          extracao_version?: number;
          farol?: string | null;
          id?: string;
          indice_pendente?: boolean;
          insumo?: string;
          ordem?: number;
          preco_orcado_rs?: number | null;
          preco_ref_real_rs?: number | null;
          qtd_orcada?: number | null;
          snapshot_label?: string | null;
          status?: string;
          teto_ipca_pct?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_insumo_excedente_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_insumo_excedente_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_insumo_excedente_params: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          data_base: string | null;
          extracao_version: number;
          farol: string | null;
          id: string;
          insumos_acima_teto: number | null;
          metodo_ativo: string | null;
          normativa: string | null;
          pct_sobre_pv: number | null;
          reajuste_pago_acum_rs: number | null;
          snapshot_label: string | null;
          status: string;
          teto_snapshot_pct: number | null;
          total_delta_rs: number | null;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          data_base?: string | null;
          extracao_version: number;
          farol?: string | null;
          id?: string;
          insumos_acima_teto?: number | null;
          metodo_ativo?: string | null;
          normativa?: string | null;
          pct_sobre_pv?: number | null;
          reajuste_pago_acum_rs?: number | null;
          snapshot_label?: string | null;
          status?: string;
          teto_snapshot_pct?: number | null;
          total_delta_rs?: number | null;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          data_base?: string | null;
          extracao_version?: number;
          farol?: string | null;
          id?: string;
          insumos_acima_teto?: number | null;
          metodo_ativo?: string | null;
          normativa?: string | null;
          pct_sobre_pv?: number | null;
          reajuste_pago_acum_rs?: number | null;
          snapshot_label?: string | null;
          status?: string;
          teto_snapshot_pct?: number | null;
          total_delta_rs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_insumo_excedente_params_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_insumo_excedente_params_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_insumo_meses: {
        Row: {
          ano: number;
          arquivo_id: string;
          codigo: string;
          config_version: string;
          contrato_id: string;
          extracao_version: number;
          id: string;
          mes: number;
          qtde: number;
        };
        Insert: {
          ano: number;
          arquivo_id: string;
          codigo: string;
          config_version: string;
          contrato_id: string;
          extracao_version: number;
          id?: string;
          mes: number;
          qtde: number;
        };
        Update: {
          ano?: number;
          arquivo_id?: string;
          codigo?: string;
          config_version?: string;
          contrato_id?: string;
          extracao_version?: number;
          id?: string;
          mes?: number;
          qtde?: number;
        };
        Relationships: [
          {
            foreignKeyName: "obra_insumo_meses_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_insumo_meses_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_insumos: {
        Row: {
          arquivo_id: string;
          classe_abc: string | null;
          codigo: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          descricao: string | null;
          extracao_version: number;
          grupo_custo: string | null;
          id: string;
          preco_orcado_unit: number | null;
          preco_reajustado_unit: number | null;
          preco_real_pago_unit: number | null;
          qtde_total: number | null;
          status: string;
          unidade: string | null;
          valor_orcado: number | null;
        };
        Insert: {
          arquivo_id: string;
          classe_abc?: string | null;
          codigo: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          descricao?: string | null;
          extracao_version: number;
          grupo_custo?: string | null;
          id?: string;
          preco_orcado_unit?: number | null;
          preco_reajustado_unit?: number | null;
          preco_real_pago_unit?: number | null;
          qtde_total?: number | null;
          status?: string;
          unidade?: string | null;
          valor_orcado?: number | null;
        };
        Update: {
          arquivo_id?: string;
          classe_abc?: string | null;
          codigo?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          descricao?: string | null;
          extracao_version?: number;
          grupo_custo?: string | null;
          id?: string;
          preco_orcado_unit?: number | null;
          preco_reajustado_unit?: number | null;
          preco_real_pago_unit?: number | null;
          qtde_total?: number | null;
          status?: string;
          unidade?: string | null;
          valor_orcado?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_insumos_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_insumos_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_insumos_fd: {
        Row: {
          arquivo_id: string | null;
          categoria: string | null;
          classe: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          fonte_recomendada: string | null;
          id: string;
          nome: string;
          ordem_abc: number;
          ordem_pq: number | null;
          preco_unit_bdi: number;
          qtd_medida: number;
          qtd_pq: number;
          status: string;
          unidade: string;
          valor_contrato_bdi: number;
          valor_medido_bdi: number;
        };
        Insert: {
          arquivo_id?: string | null;
          categoria?: string | null;
          classe: string;
          config_version?: string;
          contrato_id: string;
          created_at?: string;
          extracao_version?: number;
          fonte_recomendada?: string | null;
          id?: string;
          nome: string;
          ordem_abc: number;
          ordem_pq?: number | null;
          preco_unit_bdi: number;
          qtd_medida?: number;
          qtd_pq: number;
          status?: string;
          unidade: string;
          valor_contrato_bdi: number;
          valor_medido_bdi?: number;
        };
        Update: {
          arquivo_id?: string | null;
          categoria?: string | null;
          classe?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          fonte_recomendada?: string | null;
          id?: string;
          nome?: string;
          ordem_abc?: number;
          ordem_pq?: number | null;
          preco_unit_bdi?: number;
          qtd_medida?: number;
          qtd_pq?: number;
          status?: string;
          unidade?: string;
          valor_contrato_bdi?: number;
          valor_medido_bdi?: number;
        };
        Relationships: [
          {
            foreignKeyName: "obra_insumos_fd_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_insumos_fd_fontes: {
        Row: {
          codigo: string | null;
          contrato_id: string;
          created_at: string;
          delta_pct: number | null;
          fonte: string;
          fonte_id: string;
          id: string;
          insumo_ordem: number;
          is_recomendada: boolean;
          ordem_opcao: number;
          rotulo: string;
          status: string;
          tipo: string;
          valor_atual: number | null;
          valor_os: number | null;
        };
        Insert: {
          codigo?: string | null;
          contrato_id: string;
          created_at?: string;
          delta_pct?: number | null;
          fonte: string;
          fonte_id: string;
          id?: string;
          insumo_ordem: number;
          is_recomendada?: boolean;
          ordem_opcao: number;
          rotulo: string;
          status?: string;
          tipo?: string;
          valor_atual?: number | null;
          valor_os?: number | null;
        };
        Update: {
          codigo?: string | null;
          contrato_id?: string;
          created_at?: string;
          delta_pct?: number | null;
          fonte?: string;
          fonte_id?: string;
          id?: string;
          insumo_ordem?: number;
          is_recomendada?: boolean;
          ordem_opcao?: number;
          rotulo?: string;
          status?: string;
          tipo?: string;
          valor_atual?: number | null;
          valor_os?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_insumos_fd_fontes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_insumos_reeq: {
        Row: {
          cenario_m1_ativo: string;
          contrato_cheio_bdi: number;
          contrato_id: string;
          created_at: string;
          data_assinatura: string | null;
          data_os: string;
          data_proposta: string | null;
          data_reajuste_aniversario: string | null;
          data_verificacao: string;
          data_verificacao_reeq: string | null;
          ipca_atual: number;
          ipca_periodo: number;
          medido_acumulado: number;
          reajuste_acumulado: number | null;
          saldo_a_executar: number;
          status: string;
        };
        Insert: {
          cenario_m1_ativo?: string;
          contrato_cheio_bdi: number;
          contrato_id: string;
          created_at?: string;
          data_assinatura?: string | null;
          data_os: string;
          data_proposta?: string | null;
          data_reajuste_aniversario?: string | null;
          data_verificacao: string;
          data_verificacao_reeq?: string | null;
          ipca_atual: number;
          ipca_periodo: number;
          medido_acumulado: number;
          reajuste_acumulado?: number | null;
          saldo_a_executar: number;
          status?: string;
        };
        Update: {
          cenario_m1_ativo?: string;
          contrato_cheio_bdi?: number;
          contrato_id?: string;
          created_at?: string;
          data_assinatura?: string | null;
          data_os?: string;
          data_proposta?: string | null;
          data_reajuste_aniversario?: string | null;
          data_verificacao?: string;
          data_verificacao_reeq?: string | null;
          ipca_atual?: number;
          ipca_periodo?: number;
          medido_acumulado?: number;
          reajuste_acumulado?: number | null;
          saldo_a_executar?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_insumos_reeq_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: true;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_ipca_serie: {
        Row: {
          cenario_desc: string | null;
          cenario_id: string | null;
          cenario_nome: string | null;
          contrato_id: string;
          id: string;
          indice: number;
          mes: string;
        };
        Insert: {
          cenario_desc?: string | null;
          cenario_id?: string | null;
          cenario_nome?: string | null;
          contrato_id: string;
          id?: string;
          indice: number;
          mes: string;
        };
        Update: {
          cenario_desc?: string | null;
          cenario_id?: string | null;
          cenario_nome?: string | null;
          contrato_id?: string;
          id?: string;
          indice?: number;
          mes?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_ipca_serie_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_kpis: {
        Row: {
          contrato_id: string;
          fonte: string | null;
          kpi_key: string;
          label: string | null;
          unidade: string | null;
          updated_at: string;
          valor: number | null;
        };
        Insert: {
          contrato_id: string;
          fonte?: string | null;
          kpi_key: string;
          label?: string | null;
          unidade?: string | null;
          updated_at?: string;
          valor?: number | null;
        };
        Update: {
          contrato_id?: string;
          fonte?: string | null;
          kpi_key?: string;
          label?: string | null;
          unidade?: string | null;
          updated_at?: string;
          valor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_kpis_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_mapa_elementos: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          elemento: string;
          estaca: number | null;
          extracao_version: number;
          id: string;
          impedido_ate_mes: number | null;
          km: number;
          obs_lado: string | null;
          ordem: number;
          status: string;
          tipo: string;
          valor_rs: number | null;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          elemento: string;
          estaca?: number | null;
          extracao_version: number;
          id?: string;
          impedido_ate_mes?: number | null;
          km: number;
          obs_lado?: string | null;
          ordem: number;
          status?: string;
          tipo: string;
          valor_rs?: number | null;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          elemento?: string;
          estaca?: number | null;
          extracao_version?: number;
          id?: string;
          impedido_ate_mes?: number | null;
          km?: number;
          obs_lado?: string | null;
          ordem?: number;
          status?: string;
          tipo?: string;
          valor_rs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_mapa_elementos_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_mapa_elementos_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_mapa_segmentos: {
        Row: {
          arquivo_id: string;
          bm_corrente: number | null;
          causa_impedimento: string | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          id: string;
          imped_mes_fim: number | null;
          imped_mes_inicio: number | null;
          impedido_rs: number | null;
          item_nome: string;
          km_fim: number;
          km_inicio: number;
          liberado_rs: number | null;
          mes_lib_prevista: number | null;
          mes_lib_real: number | null;
          ordem: number;
          seg_codigo: string;
          status: string;
          status_bm: string | null;
          tipo: string;
          valor_contrato_rs: number;
        };
        Insert: {
          arquivo_id: string;
          bm_corrente?: number | null;
          causa_impedimento?: string | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          extracao_version: number;
          id?: string;
          imped_mes_fim?: number | null;
          imped_mes_inicio?: number | null;
          impedido_rs?: number | null;
          item_nome: string;
          km_fim: number;
          km_inicio: number;
          liberado_rs?: number | null;
          mes_lib_prevista?: number | null;
          mes_lib_real?: number | null;
          ordem: number;
          seg_codigo: string;
          status?: string;
          status_bm?: string | null;
          tipo: string;
          valor_contrato_rs: number;
        };
        Update: {
          arquivo_id?: string;
          bm_corrente?: number | null;
          causa_impedimento?: string | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          id?: string;
          imped_mes_fim?: number | null;
          imped_mes_inicio?: number | null;
          impedido_rs?: number | null;
          item_nome?: string;
          km_fim?: number;
          km_inicio?: number;
          liberado_rs?: number | null;
          mes_lib_prevista?: number | null;
          mes_lib_real?: number | null;
          ordem?: number;
          seg_codigo?: string;
          status?: string;
          status_bm?: string | null;
          tipo?: string;
          valor_contrato_rs?: number;
        };
        Relationships: [
          {
            foreignKeyName: "obra_mapa_segmentos_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_mapa_segmentos_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_medicao_itens: {
        Row: {
          descricao: string | null;
          id: string;
          medicao_id: string;
          nivel: number | null;
          numero_item: string;
          ordem: number;
          percentual_executado: number | null;
          preco_unitario: number | null;
          quantidade_acumulada: number | null;
          quantidade_contratada: number | null;
          quantidade_periodo: number | null;
          unidade: string | null;
          valor_contratado: number | null;
          valor_medido_acumulado: number | null;
          valor_medido_periodo: number | null;
        };
        Insert: {
          descricao?: string | null;
          id?: string;
          medicao_id: string;
          nivel?: number | null;
          numero_item: string;
          ordem: number;
          percentual_executado?: number | null;
          preco_unitario?: number | null;
          quantidade_acumulada?: number | null;
          quantidade_contratada?: number | null;
          quantidade_periodo?: number | null;
          unidade?: string | null;
          valor_contratado?: number | null;
          valor_medido_acumulado?: number | null;
          valor_medido_periodo?: number | null;
        };
        Update: {
          descricao?: string | null;
          id?: string;
          medicao_id?: string;
          nivel?: number | null;
          numero_item?: string;
          ordem?: number;
          percentual_executado?: number | null;
          preco_unitario?: number | null;
          quantidade_acumulada?: number | null;
          quantidade_contratada?: number | null;
          quantidade_periodo?: number | null;
          unidade?: string | null;
          valor_contratado?: number | null;
          valor_medido_acumulado?: number | null;
          valor_medido_periodo?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_medicao_itens_medicao_id_fkey";
            columns: ["medicao_id"];
            isOneToOne: false;
            referencedRelation: "obra_medicoes";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_medicao_totais: {
        Row: {
          fisico_pct_acumulado: number | null;
          fisico_pct_periodo: number | null;
          fonte: string;
          medicao_id: string;
          total_acumulado_valor: number | null;
          total_periodo_valor: number | null;
        };
        Insert: {
          fisico_pct_acumulado?: number | null;
          fisico_pct_periodo?: number | null;
          fonte: string;
          medicao_id: string;
          total_acumulado_valor?: number | null;
          total_periodo_valor?: number | null;
        };
        Update: {
          fisico_pct_acumulado?: number | null;
          fisico_pct_periodo?: number | null;
          fonte?: string;
          medicao_id?: string;
          total_acumulado_valor?: number | null;
          total_periodo_valor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_medicao_totais_medicao_id_fkey";
            columns: ["medicao_id"];
            isOneToOne: true;
            referencedRelation: "obra_medicoes";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_medicoes: {
        Row: {
          ano: number | null;
          arquivo_id: string;
          bm_numero: number;
          config_version: string;
          contrato_id: string;
          created_at: string;
          data_corte: string | null;
          extracao_version: number;
          id: string;
          mes: number | null;
          status: string;
        };
        Insert: {
          ano?: number | null;
          arquivo_id: string;
          bm_numero: number;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          data_corte?: string | null;
          extracao_version: number;
          id?: string;
          mes?: number | null;
          status?: string;
        };
        Update: {
          ano?: number | null;
          arquivo_id?: string;
          bm_numero?: number;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          data_corte?: string | null;
          extracao_version?: number;
          id?: string;
          mes?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_medicoes_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_medicoes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_orcamento_itens: {
        Row: {
          custo_total: number | null;
          custo_unitario: number | null;
          descricao: string | null;
          id: string;
          nivel: number | null;
          numero_item: string | null;
          orcamento_id: string;
          ordem: number;
          quantidade: number | null;
          unidade: string | null;
        };
        Insert: {
          custo_total?: number | null;
          custo_unitario?: number | null;
          descricao?: string | null;
          id?: string;
          nivel?: number | null;
          numero_item?: string | null;
          orcamento_id: string;
          ordem: number;
          quantidade?: number | null;
          unidade?: string | null;
        };
        Update: {
          custo_total?: number | null;
          custo_unitario?: number | null;
          descricao?: string | null;
          id?: string;
          nivel?: number | null;
          numero_item?: string | null;
          orcamento_id?: string;
          ordem?: number;
          quantidade?: number | null;
          unidade?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_orcamento_itens_orcamento_id_fkey";
            columns: ["orcamento_id"];
            isOneToOne: false;
            referencedRelation: "obra_orcamentos";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_orcamentos: {
        Row: {
          arquivo_id: string;
          bdi: number | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          custo_direto: number | null;
          custo_indireto: number | null;
          custo_total_atividades: number | null;
          extracao_version: number;
          id: string;
          preco_venda: number | null;
          receita: number | null;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          bdi?: number | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          custo_direto?: number | null;
          custo_indireto?: number | null;
          custo_total_atividades?: number | null;
          extracao_version: number;
          id?: string;
          preco_venda?: number | null;
          receita?: number | null;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          bdi?: number | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          custo_direto?: number | null;
          custo_indireto?: number | null;
          custo_total_atividades?: number | null;
          extracao_version?: number;
          id?: string;
          preco_venda?: number | null;
          receita?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_orcamentos_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_orcamentos_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_panorama: {
        Row: {
          arquivo_id: string;
          config_version: string;
          consolidado: string | null;
          contrato_id: string;
          created_at: string;
          dias_parados_acum: number | null;
          extracao_version: number;
          farol_clima_forca_maior: string | null;
          farol_interferencias: string | null;
          farol_liberacoes_area: string | null;
          farol_precos_quantidades: string | null;
          farol_projetos: string | null;
          farol_suprimentos_material: string | null;
          frentes_impedidas_rs: number | null;
          id: string;
          pct_areas_liberadas: number | null;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          consolidado?: string | null;
          contrato_id: string;
          created_at?: string;
          dias_parados_acum?: number | null;
          extracao_version: number;
          farol_clima_forca_maior?: string | null;
          farol_interferencias?: string | null;
          farol_liberacoes_area?: string | null;
          farol_precos_quantidades?: string | null;
          farol_projetos?: string | null;
          farol_suprimentos_material?: string | null;
          frentes_impedidas_rs?: number | null;
          id?: string;
          pct_areas_liberadas?: number | null;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          consolidado?: string | null;
          contrato_id?: string;
          created_at?: string;
          dias_parados_acum?: number | null;
          extracao_version?: number;
          farol_clima_forca_maior?: string | null;
          farol_interferencias?: string | null;
          farol_liberacoes_area?: string | null;
          farol_precos_quantidades?: string | null;
          farol_projetos?: string | null;
          farol_suprimentos_material?: string | null;
          frentes_impedidas_rs?: number | null;
          id?: string;
          pct_areas_liberadas?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_panorama_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_panorama_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_pontuais_chuva_dia: {
        Row: {
          acima_5mm: boolean | null;
          arquivo_id: string;
          chuva_mm: number | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          custo_eqp_rs: number | null;
          custo_ocioso_rs: number | null;
          data_label: string | null;
          efetivo_rdo: number | null;
          equip_producao: number | null;
          extracao_version: number;
          heq_ociosas: number | null;
          hh_ociosas: number | null;
          id: string;
          ordem: number;
          periodos_afetados: number | null;
          status: string;
        };
        Insert: {
          acima_5mm?: boolean | null;
          arquivo_id: string;
          chuva_mm?: number | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          custo_eqp_rs?: number | null;
          custo_ocioso_rs?: number | null;
          data_label?: string | null;
          efetivo_rdo?: number | null;
          equip_producao?: number | null;
          extracao_version: number;
          heq_ociosas?: number | null;
          hh_ociosas?: number | null;
          id?: string;
          ordem: number;
          periodos_afetados?: number | null;
          status?: string;
        };
        Update: {
          acima_5mm?: boolean | null;
          arquivo_id?: string;
          chuva_mm?: number | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          custo_eqp_rs?: number | null;
          custo_ocioso_rs?: number | null;
          data_label?: string | null;
          efetivo_rdo?: number | null;
          equip_producao?: number | null;
          extracao_version?: number;
          heq_ociosas?: number | null;
          hh_ociosas?: number | null;
          id?: string;
          ordem?: number;
          periodos_afetados?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_pontuais_chuva_dia_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_pontuais_chuva_dia_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_pontuais_chuva_mensal: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          excedente: number | null;
          extracao_version: number;
          fracao_excedente: number | null;
          id: string;
          mes_label: string | null;
          ordem: number;
          pleiteavel_eqp_rs: number | null;
          pleiteavel_mod_rs: number | null;
          prev_5mm: number | null;
          real_5mm: number | null;
          status: string;
          total_mes_rs: number | null;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          excedente?: number | null;
          extracao_version: number;
          fracao_excedente?: number | null;
          id?: string;
          mes_label?: string | null;
          ordem: number;
          pleiteavel_eqp_rs?: number | null;
          pleiteavel_mod_rs?: number | null;
          prev_5mm?: number | null;
          real_5mm?: number | null;
          status?: string;
          total_mes_rs?: number | null;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          excedente?: number | null;
          extracao_version?: number;
          fracao_excedente?: number | null;
          id?: string;
          mes_label?: string | null;
          ordem?: number;
          pleiteavel_eqp_rs?: number | null;
          pleiteavel_mod_rs?: number | null;
          prev_5mm?: number | null;
          real_5mm?: number | null;
          status?: string;
          total_mes_rs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_pontuais_chuva_mensal_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_pontuais_chuva_mensal_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_pontuais_evento: {
        Row: {
          arquivo_id: string;
          categoria: string | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          custo_eqp_rs: number | null;
          custo_mod_rs: number | null;
          custo_rs: number | null;
          descricao: string | null;
          dias: number | null;
          duracao: string | null;
          eqp_afetado: number | null;
          eqp_frentes_ativas: number | null;
          eqp_total: number | null;
          extracao_version: number;
          fonte: string | null;
          heq_ociosas: number | null;
          hh_ociosas: number | null;
          id: string;
          mod_afetado: number | null;
          mod_frentes_ativas: number | null;
          mod_total: number | null;
          ordem: number;
          periodo: string | null;
          status: string;
          titulo: string;
        };
        Insert: {
          arquivo_id: string;
          categoria?: string | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          custo_eqp_rs?: number | null;
          custo_mod_rs?: number | null;
          custo_rs?: number | null;
          descricao?: string | null;
          dias?: number | null;
          duracao?: string | null;
          eqp_afetado?: number | null;
          eqp_frentes_ativas?: number | null;
          eqp_total?: number | null;
          extracao_version: number;
          fonte?: string | null;
          heq_ociosas?: number | null;
          hh_ociosas?: number | null;
          id?: string;
          mod_afetado?: number | null;
          mod_frentes_ativas?: number | null;
          mod_total?: number | null;
          ordem: number;
          periodo?: string | null;
          status?: string;
          titulo: string;
        };
        Update: {
          arquivo_id?: string;
          categoria?: string | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          custo_eqp_rs?: number | null;
          custo_mod_rs?: number | null;
          custo_rs?: number | null;
          descricao?: string | null;
          dias?: number | null;
          duracao?: string | null;
          eqp_afetado?: number | null;
          eqp_frentes_ativas?: number | null;
          eqp_total?: number | null;
          extracao_version?: number;
          fonte?: string | null;
          heq_ociosas?: number | null;
          hh_ociosas?: number | null;
          id?: string;
          mod_afetado?: number | null;
          mod_frentes_ativas?: number | null;
          mod_total?: number | null;
          ordem?: number;
          periodo?: string | null;
          status?: string;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_pontuais_evento_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_pontuais_evento_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_pontuais_params: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          custo_hora_eqp_rs: number | null;
          custo_hora_mod_rs: number | null;
          eventos_pendentes: number | null;
          extracao_version: number;
          farol: string | null;
          id: string;
          jornada_dia_h: number | null;
          pendente_total_rs: number | null;
          perda_validada_rs: number | null;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          custo_hora_eqp_rs?: number | null;
          custo_hora_mod_rs?: number | null;
          eventos_pendentes?: number | null;
          extracao_version: number;
          farol?: string | null;
          id?: string;
          jornada_dia_h?: number | null;
          pendente_total_rs?: number | null;
          perda_validada_rs?: number | null;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          custo_hora_eqp_rs?: number | null;
          custo_hora_mod_rs?: number | null;
          eventos_pendentes?: number | null;
          extracao_version?: number;
          farol?: string | null;
          id?: string;
          jornada_dia_h?: number | null;
          pendente_total_rs?: number | null;
          perda_validada_rs?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_pontuais_params_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_pontuais_params_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_prazo_marcos: {
        Row: {
          arquivo_id: string;
          categoria: string | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          data_limite: string | null;
          extracao_version: number;
          farol: string | null;
          id: string;
          ordem: number;
          pct_concluido: number | null;
          status: string;
          trecho: string | null;
        };
        Insert: {
          arquivo_id: string;
          categoria?: string | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          data_limite?: string | null;
          extracao_version: number;
          farol?: string | null;
          id?: string;
          ordem: number;
          pct_concluido?: number | null;
          status?: string;
          trecho?: string | null;
        };
        Update: {
          arquivo_id?: string;
          categoria?: string | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          data_limite?: string | null;
          extracao_version?: number;
          farol?: string | null;
          id?: string;
          ordem?: number;
          pct_concluido?: number | null;
          status?: string;
          trecho?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_prazo_marcos_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_prazo_marcos_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_produtividade: {
        Row: {
          aco_total_kg: number | null;
          arquivo_id: string;
          avanco_fisico_pct: number | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          id: string;
          indice_perda_pct_raw: number | null;
          person_horas_total: number | null;
          produtividade_real_kg_ph: number | null;
          status: string;
        };
        Insert: {
          aco_total_kg?: number | null;
          arquivo_id: string;
          avanco_fisico_pct?: number | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          extracao_version: number;
          id?: string;
          indice_perda_pct_raw?: number | null;
          person_horas_total?: number | null;
          produtividade_real_kg_ph?: number | null;
          status?: string;
        };
        Update: {
          aco_total_kg?: number | null;
          arquivo_id?: string;
          avanco_fisico_pct?: number | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          id?: string;
          indice_perda_pct_raw?: number | null;
          person_horas_total?: number | null;
          produtividade_real_kg_ph?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_produtividade_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_produtividade_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_produtividade_economica: {
        Row: {
          aderencia: number | null;
          ano: number;
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          faturado_rs: number | null;
          hh_previsto: number | null;
          hh_real: number | null;
          id: string;
          mes: number;
          periodo_label: string | null;
          rs_por_hh: number | null;
          status: string;
        };
        Insert: {
          aderencia?: number | null;
          ano: number;
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          extracao_version: number;
          faturado_rs?: number | null;
          hh_previsto?: number | null;
          hh_real?: number | null;
          id?: string;
          mes: number;
          periodo_label?: string | null;
          rs_por_hh?: number | null;
          status?: string;
        };
        Update: {
          aderencia?: number | null;
          ano?: number;
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          faturado_rs?: number | null;
          hh_previsto?: number | null;
          hh_real?: number | null;
          id?: string;
          mes?: number;
          periodo_label?: string | null;
          rs_por_hh?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_produtividade_economica_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_produtividade_economica_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_produtividade_fisica: {
        Row: {
          aderencia: number | null;
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          cpu_un_h: number | null;
          created_at: string;
          disciplina: string | null;
          extracao_version: number;
          farol: string | null;
          id: string;
          ordem: number;
          pct_fisico: number | null;
          qtd_contratada: number | null;
          qtd_medida: number | null;
          real_un_h: number | null;
          servico: string;
          status: string;
          trecho: string | null;
          unidade: string | null;
        };
        Insert: {
          aderencia?: number | null;
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          cpu_un_h?: number | null;
          created_at?: string;
          disciplina?: string | null;
          extracao_version: number;
          farol?: string | null;
          id?: string;
          ordem: number;
          pct_fisico?: number | null;
          qtd_contratada?: number | null;
          qtd_medida?: number | null;
          real_un_h?: number | null;
          servico: string;
          status?: string;
          trecho?: string | null;
          unidade?: string | null;
        };
        Update: {
          aderencia?: number | null;
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          cpu_un_h?: number | null;
          created_at?: string;
          disciplina?: string | null;
          extracao_version?: number;
          farol?: string | null;
          id?: string;
          ordem?: number;
          pct_fisico?: number | null;
          qtd_contratada?: number | null;
          qtd_medida?: number | null;
          real_un_h?: number | null;
          servico?: string;
          status?: string;
          trecho?: string | null;
          unidade?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_produtividade_fisica_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_produtividade_fisica_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_produtividade_fisica_detalhe: {
        Row: {
          aderencia: number | null;
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          cpu_un_h: number | null;
          created_at: string;
          dias_servico: number | null;
          equip_dia: number | null;
          equip_horas: number | null;
          equip_principal: string | null;
          extracao_version: number;
          farol: string | null;
          frente: string | null;
          id: string;
          ordem: number;
          qtd_executada: number | null;
          real_un_h: number | null;
          servico: string;
          status: string;
          unidade: string | null;
        };
        Insert: {
          aderencia?: number | null;
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          cpu_un_h?: number | null;
          created_at?: string;
          dias_servico?: number | null;
          equip_dia?: number | null;
          equip_horas?: number | null;
          equip_principal?: string | null;
          extracao_version: number;
          farol?: string | null;
          frente?: string | null;
          id?: string;
          ordem: number;
          qtd_executada?: number | null;
          real_un_h?: number | null;
          servico: string;
          status?: string;
          unidade?: string | null;
        };
        Update: {
          aderencia?: number | null;
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          cpu_un_h?: number | null;
          created_at?: string;
          dias_servico?: number | null;
          equip_dia?: number | null;
          equip_horas?: number | null;
          equip_principal?: string | null;
          extracao_version?: number;
          farol?: string | null;
          frente?: string | null;
          id?: string;
          ordem?: number;
          qtd_executada?: number | null;
          real_un_h?: number | null;
          servico?: string;
          status?: string;
          unidade?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_produtividade_fisica_detalhe_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_produtividade_fisica_detalhe_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_produtividade_impedimento: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          hh_ociosas: number | null;
          id: string;
          impedimento: string;
          ordem: number;
          periodo: string | null;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          extracao_version: number;
          hh_ociosas?: number | null;
          id?: string;
          impedimento: string;
          ordem: number;
          periodo?: string | null;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          hh_ociosas?: number | null;
          id?: string;
          impedimento?: string;
          ordem?: number;
          periodo?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_produtividade_impedimento_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_produtividade_impedimento_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_produtividade_meses: {
        Row: {
          aco_kg: number | null;
          ano: number;
          contrato_id: string;
          id: string;
          mes: number;
          n_dias: number | null;
          person_horas: number | null;
          produtividade_id: string;
          produtividade_kg_ph: number | null;
        };
        Insert: {
          aco_kg?: number | null;
          ano: number;
          contrato_id: string;
          id?: string;
          mes: number;
          n_dias?: number | null;
          person_horas?: number | null;
          produtividade_id: string;
          produtividade_kg_ph?: number | null;
        };
        Update: {
          aco_kg?: number | null;
          ano?: number;
          contrato_id?: string;
          id?: string;
          mes?: number;
          n_dias?: number | null;
          person_horas?: number | null;
          produtividade_id?: string;
          produtividade_kg_ph?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_produtividade_meses_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_produtividade_meses_produtividade_id_fkey";
            columns: ["produtividade_id"];
            isOneToOne: false;
            referencedRelation: "obra_produtividade";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_produtividade_params: {
        Row: {
          aderencia_acum: number | null;
          arquivo_id: string;
          base_hh: string | null;
          bm_corrente: number | null;
          bmk_aterpa_rs_hh: number | null;
          bmk_setor_rs_hh: number | null;
          cambio: number | null;
          config_version: string;
          contratada_periodo_rs_hh: number | null;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          farol_aderencia: string | null;
          farol_bmk: string | null;
          faturado_acum_rs: number | null;
          hh_contratado_acum: number | null;
          hh_real_acum: number | null;
          id: string;
          jornada_mod_h_mes: number | null;
          jornada_moi_h_mes: number | null;
          meta_projeto_rs_hh: number | null;
          ponte_ociosidade_hh: number | null;
          ponte_pct_aproveitamento: number | null;
          ponte_pct_capacidade: number | null;
          ponte_pct_liberado: number | null;
          real_acum_rs_hh: number | null;
          real_div_aterpa: number | null;
          real_div_setor: number | null;
          real_mes_rs_hh: number | null;
          status: string;
          valor_total_contratado: number | null;
        };
        Insert: {
          aderencia_acum?: number | null;
          arquivo_id: string;
          base_hh?: string | null;
          bm_corrente?: number | null;
          bmk_aterpa_rs_hh?: number | null;
          bmk_setor_rs_hh?: number | null;
          cambio?: number | null;
          config_version: string;
          contratada_periodo_rs_hh?: number | null;
          contrato_id: string;
          created_at?: string;
          extracao_version: number;
          farol_aderencia?: string | null;
          farol_bmk?: string | null;
          faturado_acum_rs?: number | null;
          hh_contratado_acum?: number | null;
          hh_real_acum?: number | null;
          id?: string;
          jornada_mod_h_mes?: number | null;
          jornada_moi_h_mes?: number | null;
          meta_projeto_rs_hh?: number | null;
          ponte_ociosidade_hh?: number | null;
          ponte_pct_aproveitamento?: number | null;
          ponte_pct_capacidade?: number | null;
          ponte_pct_liberado?: number | null;
          real_acum_rs_hh?: number | null;
          real_div_aterpa?: number | null;
          real_div_setor?: number | null;
          real_mes_rs_hh?: number | null;
          status?: string;
          valor_total_contratado?: number | null;
        };
        Update: {
          aderencia_acum?: number | null;
          arquivo_id?: string;
          base_hh?: string | null;
          bm_corrente?: number | null;
          bmk_aterpa_rs_hh?: number | null;
          bmk_setor_rs_hh?: number | null;
          cambio?: number | null;
          config_version?: string;
          contratada_periodo_rs_hh?: number | null;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          farol_aderencia?: string | null;
          farol_bmk?: string | null;
          faturado_acum_rs?: number | null;
          hh_contratado_acum?: number | null;
          hh_real_acum?: number | null;
          id?: string;
          jornada_mod_h_mes?: number | null;
          jornada_moi_h_mes?: number | null;
          meta_projeto_rs_hh?: number | null;
          ponte_ociosidade_hh?: number | null;
          ponte_pct_aproveitamento?: number | null;
          ponte_pct_capacidade?: number | null;
          ponte_pct_liberado?: number | null;
          real_acum_rs_hh?: number | null;
          real_div_aterpa?: number | null;
          real_div_setor?: number | null;
          real_mes_rs_hh?: number | null;
          status?: string;
          valor_total_contratado?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_produtividade_params_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_produtividade_params_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_recursos: {
        Row: {
          arquivo_id: string;
          categoria: string;
          config_version: string;
          contratado_qtde: number | null;
          contratado_rs: number | null;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          id: string;
          ordem: number;
          real_qtde: number | null;
          real_rs: number | null;
          recurso: string;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          categoria: string;
          config_version: string;
          contratado_qtde?: number | null;
          contratado_rs?: number | null;
          contrato_id: string;
          created_at?: string;
          extracao_version: number;
          id?: string;
          ordem: number;
          real_qtde?: number | null;
          real_rs?: number | null;
          recurso: string;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          categoria?: string;
          config_version?: string;
          contratado_qtde?: number | null;
          contratado_rs?: number | null;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          id?: string;
          ordem?: number;
          real_qtde?: number | null;
          real_rs?: number | null;
          recurso?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_recursos_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_recursos_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_recursos_desvio: {
        Row: {
          arquivo_id: string;
          config_version: string;
          contratado_rs: number | null;
          contrato_id: string;
          created_at: string;
          desvio_rs: number | null;
          extracao_version: number;
          id: string;
          ordem: number;
          real_rs: number | null;
          recurso: string;
          status: string;
        };
        Insert: {
          arquivo_id: string;
          config_version: string;
          contratado_rs?: number | null;
          contrato_id: string;
          created_at?: string;
          desvio_rs?: number | null;
          extracao_version: number;
          id?: string;
          ordem: number;
          real_rs?: number | null;
          recurso: string;
          status?: string;
        };
        Update: {
          arquivo_id?: string;
          config_version?: string;
          contratado_rs?: number | null;
          contrato_id?: string;
          created_at?: string;
          desvio_rs?: number | null;
          extracao_version?: number;
          id?: string;
          ordem?: number;
          real_rs?: number | null;
          recurso?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_recursos_desvio_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_recursos_desvio_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_recursos_meses: {
        Row: {
          ano: number;
          arquivo_id: string;
          categoria: string;
          config_version: string;
          contratado_qtde: number | null;
          contratado_rs: number | null;
          contrato_id: string;
          extracao_version: number;
          id: string;
          mes: number;
          periodo_label: string | null;
          real_qtde: number | null;
          real_rs: number | null;
        };
        Insert: {
          ano: number;
          arquivo_id: string;
          categoria: string;
          config_version: string;
          contratado_qtde?: number | null;
          contratado_rs?: number | null;
          contrato_id: string;
          extracao_version: number;
          id?: string;
          mes: number;
          periodo_label?: string | null;
          real_qtde?: number | null;
          real_rs?: number | null;
        };
        Update: {
          ano?: number;
          arquivo_id?: string;
          categoria?: string;
          config_version?: string;
          contratado_qtde?: number | null;
          contratado_rs?: number | null;
          contrato_id?: string;
          extracao_version?: number;
          id?: string;
          mes?: number;
          periodo_label?: string | null;
          real_qtde?: number | null;
          real_rs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_recursos_meses_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_recursos_meses_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_relatorios: {
        Row: {
          aba: string;
          config_version: string | null;
          conteudo: Json;
          contrato_id: string;
          created_at: string;
          extracao_version: number | null;
          fatos_hash: string | null;
          gerado_em: string;
          id: string;
          modelo: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          aba: string;
          config_version?: string | null;
          conteudo: Json;
          contrato_id: string;
          created_at?: string;
          extracao_version?: number | null;
          fatos_hash?: string | null;
          gerado_em?: string;
          id?: string;
          modelo?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          aba?: string;
          config_version?: string | null;
          conteudo?: Json;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number | null;
          fatos_hash?: string | null;
          gerado_em?: string;
          id?: string;
          modelo?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_relatorios_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_secoes: {
        Row: {
          arquivo_id: string;
          coberta: boolean;
          codigo: string | null;
          colunas: Json | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          dados: Json | null;
          extracao_version: number;
          id: string;
          modulo: string | null;
          n_linhas: number;
          ordem: number;
          status: string;
          tem_dado: boolean;
          tipo: string | null;
          titulo: string;
        };
        Insert: {
          arquivo_id: string;
          coberta?: boolean;
          codigo?: string | null;
          colunas?: Json | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          dados?: Json | null;
          extracao_version: number;
          id?: string;
          modulo?: string | null;
          n_linhas?: number;
          ordem: number;
          status?: string;
          tem_dado?: boolean;
          tipo?: string | null;
          titulo: string;
        };
        Update: {
          arquivo_id?: string;
          coberta?: boolean;
          codigo?: string | null;
          colunas?: Json | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          dados?: Json | null;
          extracao_version?: number;
          id?: string;
          modulo?: string | null;
          n_linhas?: number;
          ordem?: number;
          status?: string;
          tem_dado?: boolean;
          tipo?: string | null;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_secoes_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_secoes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_sinteses: {
        Row: {
          campo: string | null;
          conteudo: Json;
          contrato_id: string;
          created_at: string;
          fatos_hash: string | null;
          id: string;
          lente: string;
          modelo: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          campo?: string | null;
          conteudo: Json;
          contrato_id: string;
          created_at?: string;
          fatos_hash?: string | null;
          id?: string;
          lente: string;
          modelo?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          campo?: string | null;
          conteudo?: Json;
          contrato_id?: string;
          created_at?: string;
          fatos_hash?: string | null;
          id?: string;
          lente?: string;
          modelo?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_sinteses_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_timeline_params: {
        Row: {
          arquivo_id: string;
          avanco_fisico_previsto_pp: number | null;
          caminho_critico_dias: number | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          criticos_impacto_fisico: number | null;
          delta_impacto_fisico_pp: number | null;
          eventos_climaticos: number | null;
          extracao_version: number;
          id: string;
          inicio_execucao: string | null;
          marcos_cumpridos: number | null;
          marcos_em_risco: number | null;
          marcos_total: number | null;
          mes_corte_indice: number | null;
          os_original: string | null;
          os_real: string | null;
          status: string;
          termino_contratual: string | null;
          termino_previsto: string | null;
          total_eventos: number | null;
          windows_obs: string | null;
        };
        Insert: {
          arquivo_id: string;
          avanco_fisico_previsto_pp?: number | null;
          caminho_critico_dias?: number | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          criticos_impacto_fisico?: number | null;
          delta_impacto_fisico_pp?: number | null;
          eventos_climaticos?: number | null;
          extracao_version: number;
          id?: string;
          inicio_execucao?: string | null;
          marcos_cumpridos?: number | null;
          marcos_em_risco?: number | null;
          marcos_total?: number | null;
          mes_corte_indice?: number | null;
          os_original?: string | null;
          os_real?: string | null;
          status?: string;
          termino_contratual?: string | null;
          termino_previsto?: string | null;
          total_eventos?: number | null;
          windows_obs?: string | null;
        };
        Update: {
          arquivo_id?: string;
          avanco_fisico_previsto_pp?: number | null;
          caminho_critico_dias?: number | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          criticos_impacto_fisico?: number | null;
          delta_impacto_fisico_pp?: number | null;
          eventos_climaticos?: number | null;
          extracao_version?: number;
          id?: string;
          inicio_execucao?: string | null;
          marcos_cumpridos?: number | null;
          marcos_em_risco?: number | null;
          marcos_total?: number | null;
          mes_corte_indice?: number | null;
          os_original?: string | null;
          os_real?: string | null;
          status?: string;
          termino_contratual?: string | null;
          termino_previsto?: string | null;
          total_eventos?: number | null;
          windows_obs?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_timeline_params_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_timeline_params_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_valor_agregado: {
        Row: {
          arquivo_id: string;
          categoria: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          farol: string | null;
          id: string;
          ordem: number;
          pct_pv: number | null;
          perda_rs: number | null;
          real_alocado_rs: number | null;
          status: string;
          va_medido_rs: number | null;
        };
        Insert: {
          arquivo_id: string;
          categoria: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          extracao_version: number;
          farol?: string | null;
          id?: string;
          ordem: number;
          pct_pv?: number | null;
          perda_rs?: number | null;
          real_alocado_rs?: number | null;
          status?: string;
          va_medido_rs?: number | null;
        };
        Update: {
          arquivo_id?: string;
          categoria?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          farol?: string | null;
          id?: string;
          ordem?: number;
          pct_pv?: number | null;
          perda_rs?: number | null;
          real_alocado_rs?: number | null;
          status?: string;
          va_medido_rs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_valor_agregado_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_valor_agregado_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_valor_agregado_mes: {
        Row: {
          ano: number;
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at: string;
          extracao_version: number;
          id: string;
          mes: number;
          ordem: number;
          periodo_label: string | null;
          real_eqp_rs: number | null;
          real_mod_rs: number | null;
          status: string;
          va_eqp_rs: number | null;
          va_mod_rs: number | null;
        };
        Insert: {
          ano: number;
          arquivo_id: string;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          extracao_version: number;
          id?: string;
          mes: number;
          ordem: number;
          periodo_label?: string | null;
          real_eqp_rs?: number | null;
          real_mod_rs?: number | null;
          status?: string;
          va_eqp_rs?: number | null;
          va_mod_rs?: number | null;
        };
        Update: {
          ano?: number;
          arquivo_id?: string;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          extracao_version?: number;
          id?: string;
          mes?: number;
          ordem?: number;
          periodo_label?: string | null;
          real_eqp_rs?: number | null;
          real_mod_rs?: number | null;
          status?: string;
          va_eqp_rs?: number | null;
          va_mod_rs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_valor_agregado_mes_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_valor_agregado_mes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_valor_agregado_servico: {
        Row: {
          arquivo_id: string;
          codigo_cpu: string | null;
          config_version: string;
          contrato_id: string;
          created_at: string;
          eqp_rs_un: number | null;
          extracao_version: number;
          id: string;
          mod_rs_un: number | null;
          ordem: number;
          pct_eqp: number | null;
          pct_mod: number | null;
          qtd_medida: number | null;
          servico: string;
          status: string;
          unidade: string | null;
          va_eqp_rs: number | null;
          va_mod_rs: number | null;
        };
        Insert: {
          arquivo_id: string;
          codigo_cpu?: string | null;
          config_version: string;
          contrato_id: string;
          created_at?: string;
          eqp_rs_un?: number | null;
          extracao_version: number;
          id?: string;
          mod_rs_un?: number | null;
          ordem: number;
          pct_eqp?: number | null;
          pct_mod?: number | null;
          qtd_medida?: number | null;
          servico: string;
          status?: string;
          unidade?: string | null;
          va_eqp_rs?: number | null;
          va_mod_rs?: number | null;
        };
        Update: {
          arquivo_id?: string;
          codigo_cpu?: string | null;
          config_version?: string;
          contrato_id?: string;
          created_at?: string;
          eqp_rs_un?: number | null;
          extracao_version?: number;
          id?: string;
          mod_rs_un?: number | null;
          ordem?: number;
          pct_eqp?: number | null;
          pct_mod?: number | null;
          qtd_medida?: number | null;
          servico?: string;
          status?: string;
          unidade?: string | null;
          va_eqp_rs?: number | null;
          va_mod_rs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obra_valor_agregado_servico_arquivo_id_fkey";
            columns: ["arquivo_id"];
            isOneToOne: false;
            referencedRelation: "obra_arquivos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_valor_agregado_servico_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obras: {
        Row: {
          adm_contratual: string | null;
          cidade: string | null;
          contratante: string | null;
          created_at: string;
          created_by: string | null;
          data_assinatura: string | null;
          data_inicio: string | null;
          data_termino: string | null;
          farol_regras: Json | null;
          gestor_obra: string | null;
          id: string;
          indice_reajuste: string | null;
          mes_referencia_rma: string | null;
          modalidade: string | null;
          nome_interno: string;
          objeto_contratado: string | null;
          periodicidade_reajuste: string | null;
          uf: string | null;
          updated_at: string;
          valor_contratual: number | null;
        };
        Insert: {
          adm_contratual?: string | null;
          cidade?: string | null;
          contratante?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_assinatura?: string | null;
          data_inicio?: string | null;
          data_termino?: string | null;
          farol_regras?: Json | null;
          gestor_obra?: string | null;
          id: string;
          indice_reajuste?: string | null;
          mes_referencia_rma?: string | null;
          modalidade?: string | null;
          nome_interno: string;
          objeto_contratado?: string | null;
          periodicidade_reajuste?: string | null;
          uf?: string | null;
          updated_at?: string;
          valor_contratual?: number | null;
        };
        Update: {
          adm_contratual?: string | null;
          cidade?: string | null;
          contratante?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_assinatura?: string | null;
          data_inicio?: string | null;
          data_termino?: string | null;
          farol_regras?: Json | null;
          gestor_obra?: string | null;
          id?: string;
          indice_reajuste?: string | null;
          mes_referencia_rma?: string | null;
          modalidade?: string | null;
          nome_interno?: string;
          objeto_contratado?: string | null;
          periodicidade_reajuste?: string | null;
          uf?: string | null;
          updated_at?: string;
          valor_contratual?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "obras_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          empresa: string | null;
          id: string;
          nome: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          empresa?: string | null;
          id: string;
          nome?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          empresa?: string | null;
          id?: string;
          nome?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      acquire_arquivo_lease: {
        Args: {
          p_lease_minutes: number;
          p_phase?: string;
          p_owner?: string;
        };
        Returns: Database["public"]["Tables"]["obra_arquivos"]["Row"][];
      };
      adm_touch_conversation: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      complete_arquivo_job: {
        Args: {
          p_id: string;
          p_status: string;
          p_error?: string;
          p_owner?: string;
        };
        Returns: boolean;
      };
      handle_new_user: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
      has_role: {
        Args: {
          _user_id: string;
          _role: Database["public"]["Enums"]["app_role"];
        };
        Returns: boolean;
      };
      normalizacao_contagens: {
        Args: {
          p_contrato: string;
        };
        Returns: {
          tabela: string;
          n: number;
          n_review: number;
        }[];
      };
      reap_stale_leases: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      renew_arquivo_lease: {
        Args: {
          p_id: string;
          p_lease_minutes: number;
          p_owner?: string;
        };
        Returns: string;
      };
      set_updated_at: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
    };
    Enums: {
      app_role: "admin" | "diretor" | "gerente_contrato" | "juridico" | "master" | "regular";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "diretor", "gerente_contrato", "juridico", "master", "regular"],
    },
  },
} as const;
