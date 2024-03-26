export interface Votes {
    vid:         number;
    pid:         number;
    vote:        string;
    points:      number;
    create_date: string;
}

export interface VoteEntry {
    pid: number;
    vote: number;
    win_points: number;
    lose_points : number;
    total_points:number;
    create_at: string; // Assuming create_at is a string
}