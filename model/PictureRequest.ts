export interface PicturePostRequest {
    pid:         number;
    pic:         string;
    total_votes: string;
    charac_name: string;
    create_date: string;
    mid:         number;
}

export interface PictureData {
    pid: number;
    total_votes: number;
  }